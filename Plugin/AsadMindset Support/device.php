<?php
/**
 * Device Tracking
 * ردیابی دستگاه‌های کاربران
 */

if (!defined('ABSPATH')) exit;

class AsadMindset_Device {

    public static function create_tables() {
        global $wpdb;
        $table = $wpdb->prefix . 'asadmindset_user_devices';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS $table (
            id           bigint(20)   NOT NULL AUTO_INCREMENT,
            user_id      bigint(20)   NOT NULL,
            device_type  varchar(20)  NOT NULL DEFAULT 'unknown',
            browser      varchar(30)  NOT NULL DEFAULT 'unknown',
            browser_ver  varchar(20)  NOT NULL DEFAULT '',
            pwa_installed tinyint(1)  NOT NULL DEFAULT 0,
            use_count    int(11)      NOT NULL DEFAULT 1,
            last_seen    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY user_device_browser (user_id, device_type, browser)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    public static function register_routes() {
        $ns = 'asadmindset/v1';

        // کاربر دستگاهش رو ثبت می‌کنه
        register_rest_route($ns, '/device/ping', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [__CLASS__, 'ping'],
            'permission_callback' => [__CLASS__, 'check_user_auth'],
        ]);

        // ادمین دستگاه‌های یه کاربر رو می‌گیره
        register_rest_route($ns, '/admin/users/(?P<id>\d+)/devices', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [__CLASS__, 'get_user_devices'],
            'permission_callback' => [__CLASS__, 'check_admin_auth'],
        ]);
    }

    /**
     * توکن رو از همه روش‌های ممکن می‌خونه
     * از instance اصلی پلاگین استفاده می‌کنه که مطمئناً کار می‌کنه
     */
    private static function get_user_id_from_token($request = null) {
        // HTTP_AUTHORIZATION مستقیماً در دسترسه (تایید شده از debug-auth)
        $auth = '';
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $hdrs = apache_request_headers();
            foreach ($hdrs as $k => $v) {
                if (strtolower($k) === 'authorization') { $auth = $v; break; }
            }
        }

        if (!preg_match('/Bearer\s(\S+)/', $auth, $m)) return 0;
        $token = $m[1];

        $secret = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : '';
        if (!$secret) return 0;
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) return 0;
            $payload = json_decode(base64_decode($parts[1]), true);
            if (!$payload || empty($payload['data']['user']['id'])) return 0;
            if (!empty($payload['exp']) && $payload['exp'] < time()) return 0;
            return (int) $payload['data']['user']['id'];
        } catch (\Exception $e) { return 0; }
    }

    public static function check_user_auth(WP_REST_Request $request) {
        return self::get_user_id_from_token($request) > 0;
    }

    public static function check_admin_auth(WP_REST_Request $request) {
        $uid = self::get_user_id_from_token($request);
        if (!$uid) return false;
        $user = get_user_by('id', $uid);
        return $user && user_can($user, 'manage_options');
    }

    /**
     * تشخیص کامل دستگاه، مرورگر و نسخه از User-Agent
     * برمی‌گردونه: ['device' => 'ios', 'browser' => 'Safari', 'version' => '17.2']
     */
    public static function parse_ua(string $ua): array {
        $ual = strtolower($ua);

        // ── Device ──
        if (strpos($ual, 'iphone') !== false || strpos($ual, 'ipad') !== false || strpos($ual, 'ipod') !== false) {
            $device = 'ios';
        } elseif (strpos($ual, 'android') !== false) {
            $device = 'android';
        } elseif (strpos($ual, 'windows') !== false) {
            $device = 'windows';
        } elseif (strpos($ual, 'macintosh') !== false || strpos($ual, 'mac os x') !== false) {
            $device = 'mac';
        } elseif (strpos($ual, 'linux') !== false) {
            $device = 'linux';
        } else {
            $device = 'unknown';
        }

        // ── Browser + Version ──
        // ترتیب مهمه — Chrome باید قبل از Safari چک بشه
        $browser = 'unknown';
        $version = '';

        if (preg_match('/edg(?:e|\/)([\d.]+)/i', $ua, $m)) {
            $browser = 'Edge';
            $version = $m[1];
        } elseif (preg_match('/opr\/([\d.]+)/i', $ua, $m) || preg_match('/opera\/([\d.]+)/i', $ua, $m)) {
            $browser = 'Opera';
            $version = $m[1];
        } elseif (preg_match('/chrome\/([\d.]+)/i', $ua, $m) && strpos($ual, 'chromium') === false) {
            $browser = 'Chrome';
            $version = $m[1];
        } elseif (preg_match('/firefox\/([\d.]+)/i', $ua, $m)) {
            $browser = 'Firefox';
            $version = $m[1];
        } elseif (preg_match('/safari\/([\d.]+)/i', $ua, $m) && strpos($ual, 'chrome') === false) {
            $browser = 'Safari';
            // نسخه واقعی Safari در Version/ هست
            if (preg_match('/version\/([\d.]+)/i', $ua, $mv)) $version = $mv[1];
            else $version = $m[1];
        } elseif (preg_match('/msie ([\d.]+)/i', $ua, $m) || preg_match('/trident.*rv:([\d.]+)/i', $ua, $m)) {
            $browser = 'IE';
            $version = $m[1];
        } elseif (preg_match('/samsung.*([\d.]+)/i', $ua, $m)) {
            $browser = 'Samsung';
            $version = $m[1];
        }

        // فقط major.minor نگه دار
        if ($version) {
            $parts = explode('.', $version);
            $version = implode('.', array_slice($parts, 0, 2));
        }

        return ['device' => $device, 'browser' => $browser, 'version' => $version];
    }

    /**
     * ثبت/آپدیت دستگاه کاربر
     */
    public static function ping(WP_REST_Request $req) {
        global $wpdb;
        $uid = self::get_user_id_from_token($req);
        if (!$uid) return new WP_Error('unauthorized', 'خطای احراز هویت', ['status' => 401]);

        // User-Agent از header یا body
        $p       = $req->get_json_params();
        $ua      = $req->get_header('user-agent') ?: ($p['user_agent'] ?? '');
        // اگه frontend مرورگر رو فرستاد استفاده کن، وگرنه سرور parse کنه
        $parsed  = self::parse_ua($ua);
        $device  = $parsed['device'];
        $browser = !empty($p['browser']) && $p['browser'] !== 'unknown'
                   ? sanitize_text_field($p['browser'])
                   : $parsed['browser'];
        $version = !empty($p['browser_ver'])
                   ? sanitize_text_field($p['browser_ver'])
                   : $parsed['version'];
        $pwa_installed = !empty($p['pwa_installed']) ? 1 : 0;

        $table = $wpdb->prefix . 'asadmindset_user_devices';
        $now   = current_time('mysql');

        // unique key: user_id + device_type + browser
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE user_id=%d AND device_type=%s AND browser=%s",
            $uid, $device, $browser
        ));

        if ($existing) {
            $wpdb->query($wpdb->prepare(
                "UPDATE $table SET use_count = use_count + 1, last_seen = %s, browser_ver = %s, pwa_installed = %d
                 WHERE user_id=%d AND device_type=%s AND browser=%s",
                $now, $version, $pwa_installed, $uid, $device, $browser
            ));
        } else {
            $wpdb->insert($table, [
                'user_id'      => $uid,
                'device_type'  => $device,
                'browser'      => $browser,
                'browser_ver'  => $version,
                'pwa_installed'=> $pwa_installed,
                'use_count'    => 1,
                'last_seen'    => $now,
                'created_at'   => $now,
            ], ['%d', '%s', '%s', '%s', '%d', '%d', '%s', '%s']);
        }

        return rest_ensure_response(['success' => true, 'device' => $device, 'browser' => $browser, 'version' => $version]);
    }

    /**
     * دریافت دستگاه‌های یه کاربر (برای پنل ادمین)
     */
    public static function get_user_devices(WP_REST_Request $req) {
        global $wpdb;
        $uid   = (int) $req->get_param('id');
        $table = $wpdb->prefix . 'asadmindset_user_devices';

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT device_type, browser, browser_ver, pwa_installed, use_count, last_seen 
             FROM $table WHERE user_id=%d 
             ORDER BY use_count DESC, last_seen DESC",
            $uid
        ));

        return rest_ensure_response(array_map(function($r) {
            return [
                'deviceType'   => $r->device_type,
                'browser'      => $r->browser,
                'browserVer'   => $r->browser_ver,
                'pwaInstalled' => (bool) intval($r->pwa_installed ?? 0),
                'useCount'     => (int) $r->use_count,
                'lastSeen'     => $r->last_seen,
            ];
        }, $rows ?: []));
    }

    /**
     * دریافت دستگاه‌های چند کاربر دفعه‌ای (برای لیست کاربران)
     */
    public static function get_devices_for_users(array $user_ids): array {
        if (empty($user_ids)) return [];
        global $wpdb;
        $table = $wpdb->prefix . 'asadmindset_user_devices';

        $placeholders = implode(',', array_fill(0, count($user_ids), '%d'));
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT user_id, device_type, use_count, last_seen 
                 FROM $table 
                 WHERE user_id IN ($placeholders)
                 ORDER BY user_id, use_count DESC",
                ...$user_ids
            )
        );

        $result = [];
        foreach ($rows as $r) {
            $uid = (int) $r->user_id;
            if (!isset($result[$uid])) $result[$uid] = [];
            $result[$uid][] = [
                'deviceType' => $r->device_type,
                'browser'    => $r->browser,
                'browserVer' => $r->browser_ver,
                'useCount'   => (int) $r->use_count,
                'lastSeen'   => $r->last_seen,
            ];
        }
        return $result;
    }
}

add_action('rest_api_init', ['AsadMindset_Device', 'register_routes']);

add_action('init', function () {
    static $done = false;
    if ($done) return;
    $done = true;
    // همیشه اجرا کن تا ستون‌های جدید اضافه بشن
    AsadMindset_Device::create_tables();
    update_option('asadmindset_device_table_v3', 1);
}, 25);