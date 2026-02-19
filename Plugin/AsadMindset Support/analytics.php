<?php
/**
 * Analytics & User Activity Tracking
 * ثبت و گزارش فعالیت کاربران
 */

if (!defined('ABSPATH')) exit;

class AsadMindset_Analytics {

    // ──────────────────────────────────────────
    // جدول‌سازی
    // ──────────────────────────────────────────

    public static function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'asadmindset_events';

        $sql = "CREATE TABLE IF NOT EXISTS $table (
            id          bigint(20)   NOT NULL AUTO_INCREMENT,
            user_id     bigint(20)   NOT NULL,
            event_type  varchar(50)  NOT NULL,
            payload     longtext     DEFAULT NULL,
            session_id  varchar(64)  DEFAULT NULL,
            created_at  datetime     DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id    (user_id),
            KEY event_type (event_type),
            KEY created_at (created_at),
            KEY session_id (session_id)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    // ──────────────────────────────────────────
    // Auth helper
    // ──────────────────────────────────────────

    private static function get_user_id_from_token() {
        $auth = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
        if (!preg_match('/Bearer\s(\S+)/', $auth, $m)) return 0;
        $secret = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : '';
        if (!$secret) return 0;
        try {
            $parts = explode('.', $m[1]);
            if (count($parts) !== 3) return 0;
            $payload = json_decode(base64_decode($parts[1]), true);
            if (!$payload || empty($payload['data']['user']['id'])) return 0;
            if (!empty($payload['exp']) && $payload['exp'] < time()) return 0;
            return (int) $payload['data']['user']['id'];
        } catch (Exception $e) { return 0; }
    }

    public static function can_view_reports() {
        $uid = self::get_user_id_from_token();
        if (!$uid) return false;
        $user = get_user_by('id', $uid);
        if ($user && user_can($user, 'manage_options')) return true;
        global $wpdb;
        $t = $wpdb->prefix . 'sub_admins';
        return (bool) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $t WHERE user_id=%d AND is_active=1", $uid
        ));
    }

    // ──────────────────────────────────────────
    // ثبت رویداد داخلی (از سایر ماژول‌ها)
    // ──────────────────────────────────────────

    public static function track(int $user_id, string $event_type, array $payload = [], string $session_id = '') {
        if (!$user_id) return;
        global $wpdb;
        $table = $wpdb->prefix . 'asadmindset_events';
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) return;

        $wpdb->insert($table, [
            'user_id'    => $user_id,
            'event_type' => $event_type,
            'payload'    => $payload ? json_encode($payload, JSON_UNESCAPED_UNICODE) : null,
            'session_id' => $session_id ?: null,
            'created_at' => current_time('mysql'),
        ]);
    }

    // ──────────────────────────────────────────
    // REST API routes
    // ──────────────────────────────────────────

    public static function register_routes() {
        $ns = 'asadmindset/v1';

        // دریافت batch رویدادها از frontend
        register_rest_route($ns, '/analytics/track', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [__CLASS__, 'receive_events'],
            'permission_callback' => '__return_true',
        ]);

        // گزارش خلاصه یک کاربر
        register_rest_route($ns, '/admin/analytics/user/(?P<id>\d+)', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [__CLASS__, 'user_report'],
            'permission_callback' => [__CLASS__, 'can_view_reports'],
        ]);

        // گزارش کلی اپ
        register_rest_route($ns, '/admin/analytics/overview', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [__CLASS__, 'overview_report'],
            'permission_callback' => [__CLASS__, 'can_view_reports'],
        ]);

        // رویدادهای خام یک کاربر
        register_rest_route($ns, '/admin/analytics/user/(?P<id>\d+)/events', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [__CLASS__, 'user_events'],
            'permission_callback' => [__CLASS__, 'can_view_reports'],
        ]);
    }

    // ──────────────────────────────────────────
    // دریافت batch رویدادها از frontend
    // ──────────────────────────────────────────

    public static function receive_events(WP_REST_Request $req) {
        $user_id = self::get_user_id_from_token();
        if (!$user_id) return new WP_Error('unauthorized', 'Unauthorized', ['status' => 401]);

        $p      = $req->get_json_params();
        $events = isset($p['events']) && is_array($p['events']) ? $p['events'] : [];

        if (empty($events)) {
            return rest_ensure_response(['success' => true, 'saved' => 0]);
        }

        // حداکثر ۵۰ رویداد در هر درخواست
        $events = array_slice($events, 0, 50);

        global $wpdb;
        $table = $wpdb->prefix . 'asadmindset_events';
        $saved = 0;

        $allowed_events = [
            'app_open', 'app_close',
            'tab_view', 'tab_leave',
            'session_start', 'session_end',
            'live_watch_start', 'live_watch_end',
            'content_view',
        ];

        foreach ($events as $e) {
            $type = isset($e['type']) ? sanitize_text_field($e['type']) : '';
            if (!in_array($type, $allowed_events)) continue;

            $wpdb->insert($table, [
                'user_id'    => $user_id,
                'event_type' => $type,
                'payload'    => isset($e['payload']) ? json_encode($e['payload'], JSON_UNESCAPED_UNICODE) : null,
                'session_id' => isset($e['session_id']) ? sanitize_text_field($e['session_id']) : null,
                'created_at' => isset($e['ts']) ? date('Y-m-d H:i:s', (int) ($e['ts'] / 1000)) : current_time('mysql'),
            ]);
            $saved++;
        }

        return rest_ensure_response(['success' => true, 'saved' => $saved]);
    }

    // ──────────────────────────────────────────
    // گزارش خلاصه یک کاربر
    // ──────────────────────────────────────────

    public static function user_report(WP_REST_Request $req) {
        global $wpdb;
        $uid   = (int) $req->get_param('id');
        $days  = (int) ($req->get_param('days') ?: 30);
        $table = $wpdb->prefix . 'asadmindset_events';
        $since = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        // تعداد session ها
        $sessions = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT session_id) FROM $table
             WHERE user_id=%d AND event_type='session_start' AND created_at >= %s",
            $uid, $since
        ));

        // آخرین فعالیت
        $last_seen = $wpdb->get_var($wpdb->prepare(
            "SELECT MAX(created_at) FROM $table WHERE user_id=%d", $uid
        ));

        // تعداد بازدید هر تب
        $tab_raw = $wpdb->get_results($wpdb->prepare(
            "SELECT payload FROM $table
             WHERE user_id=%d AND event_type='tab_view' AND created_at >= %s",
            $uid, $since
        ));
        $tab_counts = [];
        foreach ($tab_raw as $row) {
            $p = json_decode($row->payload, true);
            $tab = isset($p['tab']) ? $p['tab'] : 'unknown';
            $tab_counts[$tab] = ($tab_counts[$tab] ?? 0) + 1;
        }
        arsort($tab_counts);
        $tab_views = array_map(fn($tab, $count) => (object)['tab' => $tab, 'count' => $count], array_keys($tab_counts), $tab_counts);

        // مدت زمان تقریبی در اپ (بر اساس session_end duration)
        $duration_raw = $wpdb->get_results($wpdb->prepare(
            "SELECT payload FROM $table WHERE user_id=%d AND event_type='session_end' AND created_at >= %s",
            $uid, $since
        ));
        $total_seconds = 0;
        foreach ($duration_raw as $row) {
            $p = json_decode($row->payload, true);
            $total_seconds += isset($p['duration']) ? (int)$p['duration'] : 0;
        }

        // تعداد بازدید لایو
        $live_views = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table
             WHERE user_id=%d AND event_type='live_watch_start' AND created_at >= %s",
            $uid, $since
        ));

        // روزهایی که فعال بوده
        $active_days = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT DATE(created_at)) FROM $table
             WHERE user_id=%d AND created_at >= %s",
            $uid, $since
        ));

        // اولین و آخرین رویداد
        $first_event = $wpdb->get_var($wpdb->prepare(
            "SELECT MIN(created_at) FROM $table WHERE user_id=%d", $uid
        ));

        return rest_ensure_response([
            'user_id'       => $uid,
            'period_days'   => $days,
            'sessions'      => $sessions,
            'active_days'   => $active_days,
            'total_minutes' => round($total_seconds / 60),
            'live_views'    => $live_views,
            'last_seen'     => $last_seen,
            'first_seen'    => $first_event,
            'tab_views'     => array_map(fn($r) => ['tab' => $r->tab, 'count' => (int)$r->count], $tab_views),
        ]);
    }

    // ──────────────────────────────────────────
    // گزارش کلی اپ
    // ──────────────────────────────────────────

    public static function overview_report(WP_REST_Request $req) {
        global $wpdb;
        $days  = (int) ($req->get_param('days') ?: 7);
        $table = $wpdb->prefix . 'asadmindset_events';
        $since = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        // کاربران فعال در بازه
        $active_users = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT user_id) FROM $table WHERE created_at >= %s", $since
        ));

        // کل session ها
        $total_sessions = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table WHERE event_type='session_start' AND created_at >= %s", $since
        ));

        // محبوب‌ترین تب‌ها
        $tab_raw2 = $wpdb->get_results($wpdb->prepare(
            "SELECT payload FROM $table WHERE event_type='tab_view' AND created_at >= %s",
            $since
        ));
        $tab_counts2 = [];
        foreach ($tab_raw2 as $row) {
            $p = json_decode($row->payload, true);
            $tab = isset($p['tab']) ? $p['tab'] : 'unknown';
            $tab_counts2[$tab] = ($tab_counts2[$tab] ?? 0) + 1;
        }
        arsort($tab_counts2);
        $tab_counts2 = array_slice($tab_counts2, 0, 10, true);
        $popular_tabs = array_map(fn($tab, $count) => (object)['tab' => $tab, 'count' => $count], array_keys($tab_counts2), $tab_counts2);

        // فعالیت روز به روز
        $daily = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as users, COUNT(*) as events
             FROM $table WHERE created_at >= %s
             GROUP BY DATE(created_at) ORDER BY date ASC",
            $since
        ));

        // کاربرانی که ۷ روز نیومدن (inactive)
        $inactive_users = (int) $wpdb->get_var(
            "SELECT COUNT(DISTINCT u.ID) FROM {$wpdb->users} u
             LEFT JOIN $table e ON u.ID = e.user_id AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             WHERE e.user_id IS NULL"
        );

        return rest_ensure_response([
            'period_days'    => $days,
            'active_users'   => $active_users,
            'total_sessions' => $total_sessions,
            'inactive_users' => $inactive_users,
            'popular_tabs'   => array_map(fn($r) => ['tab' => $r->tab, 'count' => (int)$r->count], $popular_tabs),
            'daily'          => array_map(fn($r) => [
                'date'   => $r->date,
                'users'  => (int)$r->users,
                'events' => (int)$r->events
            ], $daily),
        ]);
    }

    // ──────────────────────────────────────────
    // رویدادهای خام یک کاربر
    // ──────────────────────────────────────────

    public static function user_events(WP_REST_Request $req) {
        global $wpdb;
        $uid    = (int) $req->get_param('id');
        $limit  = min((int) ($req->get_param('limit') ?: 50), 200);
        $offset = (int) ($req->get_param('offset') ?: 0);
        $type   = sanitize_text_field($req->get_param('type') ?: '');
        $table  = $wpdb->prefix . 'asadmindset_events';

        $where = $wpdb->prepare("WHERE user_id=%d", $uid);
        if ($type) $where .= $wpdb->prepare(" AND event_type=%s", $type);

        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table $where");
        $rows  = $wpdb->get_results($wpdb->prepare(
            "SELECT id, event_type, payload, session_id, created_at FROM $table $where
             ORDER BY created_at DESC LIMIT %d OFFSET %d",
            $limit, $offset
        ));

        return rest_ensure_response([
            'total'  => $total,
            'limit'  => $limit,
            'offset' => $offset,
            'events' => array_map(fn($r) => [
                'id'         => (int) $r->id,
                'event_type' => $r->event_type,
                'payload'    => $r->payload ? json_decode($r->payload, true) : null,
                'session_id' => $r->session_id,
                'created_at' => $r->created_at,
            ], $rows),
        ]);
    }
}

add_action('rest_api_init', ['AsadMindset_Analytics', 'register_routes']);

add_action('init', function () {
    static $done = false;
    if ($done) return;
    $done = true;
    if (!get_option('asadmindset_analytics_table_v1')) {
        AsadMindset_Analytics::create_tables();
        update_option('asadmindset_analytics_table_v1', 1);
    }
}, 25);