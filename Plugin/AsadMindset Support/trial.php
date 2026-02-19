<?php
/**
 * Trial Plans Management
 * 
 * سیستم پلن‌های تریال آیتم‌محور
 * هر پلن: نام، محصول، مدت، بازه زمانی، وضعیت
 * هنگام ثبت‌نام کاربر، همه پلن‌های فعال اجرا می‌شوند
 */

if (!defined('ABSPATH')) {
    exit;
}

class AsadMindset_Trial {

    /**
     * ایجاد جدول پلن‌های تریال
     */
    public static function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'asadmindset_trial_plans';

        $sql = "CREATE TABLE IF NOT EXISTS $table (
            id                    bigint(20)   NOT NULL AUTO_INCREMENT,
            name                  varchar(150) NOT NULL,
            product               varchar(50)  NOT NULL DEFAULT 'alpha_channel',
            duration_days         int(11)      NOT NULL DEFAULT 7,
            is_active             tinyint(1)   NOT NULL DEFAULT 1,
            valid_from            date         DEFAULT NULL,
            valid_until           date         DEFAULT NULL,
            user_reg_from         date         DEFAULT NULL,
            user_reg_until        date         DEFAULT NULL,
            created_at            datetime     DEFAULT CURRENT_TIMESTAMP,
            updated_at            datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    /**
     * ثبت REST API endpoints
     */
    public static function register_routes() {
        $ns = 'asadmindset/v1';

        // لیست همه پلن‌ها
        register_rest_route($ns, '/admin/trial/plans', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [__CLASS__, 'get_plans'],
                'permission_callback' => [__CLASS__, 'can_view'],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [__CLASS__, 'create_plan'],
                'permission_callback' => [__CLASS__, 'can_edit'],
            ],
        ]);

        // دریافت و پاک کردن pending trial notification (برای کاربر عادی)
        register_rest_route($ns, '/trial/notification', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [__CLASS__, 'get_pending_notification'],
                'permission_callback' => '__return_true',
            ],
        ]);

        // اجرای دستی پلن‌های تریال برای کاربران قدیمی (ادمین)
        register_rest_route($ns, '/admin/trial/run-for-existing', [
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [__CLASS__, 'run_for_existing_users'],
                'permission_callback' => [__CLASS__, 'can_edit'],
            ],
        ]);

        // تنظیمات کلی تریال (is_enabled)
        register_rest_route($ns, '/admin/trial/settings', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [__CLASS__, 'get_settings'],
                'permission_callback' => [__CLASS__, 'can_view'],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [__CLASS__, 'update_settings'],
                'permission_callback' => [__CLASS__, 'can_edit'],
            ],
        ]);

        // ویرایش / حذف یک پلن
        register_rest_route($ns, '/admin/trial/plans/(?P<id>\d+)', [
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [__CLASS__, 'update_plan'],
                'permission_callback' => [__CLASS__, 'can_edit'],
            ],
            [
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => [__CLASS__, 'delete_plan'],
                'permission_callback' => [__CLASS__, 'can_edit'],
            ],
        ]);
    }

    // ── دسترسی‌ها ──

    private static function get_user_id() {
        $token = null;
        $auth  = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
        if (preg_match('/Bearer\s(\S+)/', $auth, $m)) $token = $m[1];
        if (!$token) return 0;

        $secret = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : '';
        if (!$secret) return 0;

        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) return 0;
            $payload = json_decode(base64_decode($parts[1]), true);
            if (!$payload || empty($payload['data']['user']['id'])) return 0;
            if (!empty($payload['exp']) && $payload['exp'] < time()) return 0;
            return (int) $payload['data']['user']['id'];
        } catch (\Exception $e) {
            return 0;
        }
    }

    public static function can_view() {
        $uid  = self::get_user_id();
        if (!$uid) return false;
        $user = get_user_by('id', $uid);
        // ادمین اصلی
        if ($user && user_can($user, 'manage_options')) return true;
        // ساب‌ادمین با هر دسترسی
        global $wpdb;
        $t   = $wpdb->prefix . 'sub_admins';
        $row = $wpdb->get_var($wpdb->prepare("SELECT id FROM $t WHERE user_id=%d AND is_active=1", $uid));
        return !empty($row);
    }

    public static function can_edit() {
        $uid  = self::get_user_id();
        if (!$uid) return false;
        $user = get_user_by('id', $uid);
        // ادمین اصلی
        if ($user && user_can($user, 'manage_options')) return true;
        // ساب‌ادمین با دسترسی trial_edit
        global $wpdb;
        $t   = $wpdb->prefix . 'sub_admins';
        $row = $wpdb->get_row($wpdb->prepare("SELECT permissions FROM $t WHERE user_id=%d AND is_active=1", $uid));
        if (!$row) return false;
        $perms = json_decode($row->permissions, true);
        return is_array($perms) && in_array('trial_edit', $perms);
    }

    // ── CRUD ──

    public static function get_plans() {
        global $wpdb;
        $table = $wpdb->prefix . 'asadmindset_trial_plans';
        $rows  = $wpdb->get_results("SELECT * FROM $table ORDER BY id DESC");
        return rest_ensure_response(array_map([__CLASS__, 'format_plan'], $rows ?: []));
    }

    public static function create_plan(WP_REST_Request $req) {
        global $wpdb;
        $p = $req->get_json_params();

        $name          = sanitize_text_field($p['name']          ?? '');
        $product       = sanitize_text_field($p['product']       ?? 'alpha_channel');
        $duration_days = max(1, (int) ($p['duration_days']       ?? 7));
        $valid_from    = sanitize_text_field($p['valid_from']     ?? '');
        $valid_until   = sanitize_text_field($p['valid_until']    ?? '');
        $user_reg_from  = sanitize_text_field($p['user_reg_from']  ?? '');
        $user_reg_until = sanitize_text_field($p['user_reg_until'] ?? '');

        if (empty($name)) {
            return new WP_Error('missing_name', 'نام پلن الزامی است', ['status' => 400]);
        }

        $allowed_products = ['alpha_channel', 'academy', 'ai_chat'];
        if (!in_array($product, $allowed_products)) $product = 'alpha_channel';

        $wpdb->insert(
            $wpdb->prefix . 'asadmindset_trial_plans',
            [
                'name'          => $name,
                'product'       => $product,
                'duration_days' => $duration_days,
                'is_active'     => 1,
                'valid_from'    => $valid_from    ?: null,
                'valid_until'   => $valid_until   ?: null,
                'user_reg_from'  => $user_reg_from  ?: null,
                'user_reg_until' => $user_reg_until ?: null,
            ],
            ['%s', '%s', '%d', '%d', '%s', '%s', '%s', '%s']
        );

        $plan = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}asadmindset_trial_plans WHERE id = %d",
            $wpdb->insert_id
        ));

        return rest_ensure_response(self::format_plan($plan));
    }

    public static function update_plan(WP_REST_Request $req) {
        global $wpdb;
        $id    = (int) $req->get_param('id');
        $p     = $req->get_json_params();
        $table = $wpdb->prefix . 'asadmindset_trial_plans';

        $plan = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id=%d", $id));
        if (!$plan) return new WP_Error('not_found', 'پلن یافت نشد', ['status' => 404]);

        $data   = [];
        $format = [];

        if (isset($p['name']))          { $data['name']          = sanitize_text_field($p['name']);           $format[] = '%s'; }
        if (isset($p['product']))       { $data['product']       = sanitize_text_field($p['product']);        $format[] = '%s'; }
        if (isset($p['duration_days'])) { $data['duration_days'] = max(1, (int) $p['duration_days']);         $format[] = '%d'; }
        if (isset($p['is_active']))     { $data['is_active']     = $p['is_active'] ? 1 : 0;                  $format[] = '%d'; }
        if (array_key_exists('valid_from', $p))       { $data['valid_from']       = $p['valid_from']       ?: null; $format[] = '%s'; }
        if (array_key_exists('valid_until', $p))      { $data['valid_until']      = $p['valid_until']      ?: null; $format[] = '%s'; }
        if (array_key_exists('user_reg_from', $p))    { $data['user_reg_from']    = $p['user_reg_from']    ?: null; $format[] = '%s'; }
        if (array_key_exists('user_reg_until', $p))   { $data['user_reg_until']   = $p['user_reg_until']   ?: null; $format[] = '%s'; }

        if (empty($data)) return new WP_Error('no_data', 'داده‌ای برای بروزرسانی وجود ندارد', ['status' => 400]);

        $wpdb->update($table, $data, ['id' => $id], $format, ['%d']);

        $plan = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id=%d", $id));
        return rest_ensure_response(self::format_plan($plan));
    }

    public static function delete_plan(WP_REST_Request $req) {
        global $wpdb;
        $id    = (int) $req->get_param('id');
        $table = $wpdb->prefix . 'asadmindset_trial_plans';

        $plan = $wpdb->get_row($wpdb->prepare("SELECT id FROM $table WHERE id=%d", $id));
        if (!$plan) return new WP_Error('not_found', 'پلن یافت نشد', ['status' => 404]);

        $wpdb->delete($table, ['id' => $id], ['%d']);
        return rest_ensure_response(['success' => true, 'deleted_id' => $id]);
    }

    // ── Settings ──

    public static function get_pending_notification(WP_REST_Request $req) {
        // توکن از HTTP_AUTHORIZATION
        $auth = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
        if (!preg_match('/Bearer\s(\S+)/', $auth, $m)) {
            return rest_ensure_response(null);
        }
        $secret = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : '';
        if (!$secret) return rest_ensure_response(null);
        try {
            $parts = explode('.', $m[1]);
            if (count($parts) !== 3) return rest_ensure_response(null);
            $payload = json_decode(base64_decode($parts[1]), true);
            if (!$payload || empty($payload['data']['user']['id'])) return rest_ensure_response(null);
            if (!empty($payload['exp']) && $payload['exp'] < time()) return rest_ensure_response(null);
            $user_id = (int) $payload['data']['user']['id'];
        } catch (Exception $e) {
            return rest_ensure_response(null);
        }

        $notif = get_user_meta($user_id, 'pending_trial_notification', true);
        if (!$notif) return rest_ensure_response([]);

        // بعد از خوندن، پاکش می‌کنیم
        delete_user_meta($user_id, 'pending_trial_notification');

        $data = json_decode($notif, true);
        // اگه آبجکت قدیمی بود (قبل از آپدیت) تبدیل به آرایه کن
        if (isset($data['plan_name'])) $data = [$data];
        return rest_ensure_response($data ?: []);
    }

    /**
     * اجرای پلن‌های تریال برای کاربران قدیمی (بدون خرید قبلی)
     */
    public static function run_for_existing_users(WP_REST_Request $req) {
        global $wpdb;

        @set_time_limit(120);

        $offset     = (int) ($req->get_param('offset') ?? 0);
        $batch_size = 20;

        $table = $wpdb->prefix . 'asadmindset_trial_plans';
        $now   = current_time('Y-m-d');

        $plans = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM $table
                 WHERE is_active = 1
                   AND (valid_from  IS NULL OR valid_from  <= %s)
                   AND (valid_until IS NULL OR valid_until >= %s)",
                $now, $now
            )
        );

        if (empty($plans)) {
            return rest_ensure_response(['success' => true, 'done' => true, 'message' => 'هیچ پلن فعالی یافت نشد']);
        }

        $subs_table          = $wpdb->prefix . 'subscriptions';
        $users_with_purchase = $wpdb->get_col(
            "SELECT DISTINCT user_id FROM $subs_table WHERE amount > 0 AND status IN ('approved','pending')"
        );

        $all_users    = $wpdb->get_col("SELECT ID FROM {$wpdb->users} ORDER BY ID ASC");
        $target_users = array_values(array_diff($all_users, $users_with_purchase ?: []));
        $total        = count($target_users);

        $batch = array_slice($target_users, $offset, $batch_size);

        $processed = 0;
        foreach ($batch as $user_id) {
            foreach ($plans as $plan) {
                self::give_trial((int) $user_id, $plan);
            }
            $processed++;
        }

        $next_offset = $offset + $batch_size;
        $done        = $next_offset >= $total;

        return rest_ensure_response([
            'success'     => true,
            'done'        => $done,
            'processed'   => $processed,
            'offset'      => $offset,
            'next_offset' => $done ? null : $next_offset,
            'total'       => $total,
            'message'     => "{$processed} کاربر از {$total} پردازش شد (offset: {$offset})"
        ]);
    }

    public static function get_settings() {
        $is_enabled = (bool) get_option('asadmindset_trial_enabled', false);
        return rest_ensure_response(['is_enabled' => $is_enabled]);
    }

    public static function update_settings(WP_REST_Request $req) {
        $p = $req->get_json_params();
        if (isset($p['is_enabled'])) {
            update_option('asadmindset_trial_enabled', $p['is_enabled'] ? 1 : 0);
        }
        return rest_ensure_response(['is_enabled' => (bool) get_option('asadmindset_trial_enabled', false)]);
    }

    // ── Format ──
    private static function format_plan($row) {
        return [
            'id'           => (int)    $row->id,
            'name'         =>          $row->name,
            'product'      =>          $row->product,
            'durationDays' => (int)    $row->duration_days,
            'isActive'     => (bool)   intval($row->is_active),
            'validFrom'    =>          $row->valid_from,
            'validUntil'   =>          $row->valid_until,
            'userRegFrom'  =>          $row->user_reg_from,
            'userRegUntil' =>          $row->user_reg_until,
            'createdAt'    =>          $row->created_at,
        ];
    }

    // ── هوک ثبت‌نام ──

    /**
     * هنگام ثبت‌نام کاربر جدید، همه پلن‌های فعال را اجرا کن
     */
    public static function grant_on_register(int $user_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'asadmindset_trial_plans';

        // جدول وجود داره؟
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) return;

        $now = current_time('Y-m-d');

        // تاریخ ثبت‌نام کاربر (همین لحظه است چون هوک user_register است)
        $user_reg_date = $now;

        $plans = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM $table
                 WHERE is_active = 1
                   AND (valid_from  IS NULL OR valid_from  <= %s)
                   AND (valid_until IS NULL OR valid_until >= %s)
                   AND (user_reg_from  IS NULL OR user_reg_from  <= %s)
                   AND (user_reg_until IS NULL OR user_reg_until >= %s)",
                $now, $now, $user_reg_date, $user_reg_date
            )
        );

        if (empty($plans)) return;

        foreach ($plans as $plan) {
            self::give_trial($user_id, $plan);
        }
    }

    /**
     * اعطای یک پلن تریال به کاربر
     */
    private static function give_trial(int $user_id, object $plan) {
        $duration = max(1, (int) $plan->duration_days);
        $product  = $plan->product;

        if ($product === 'alpha_channel') {
            self::create_subscription($user_id, $duration, $plan->name, $product);
        }
        // در آینده: academy, ai_chat
    }

    private static function create_subscription(int $user_id, int $duration_days, string $plan_name, string $product) {
        global $wpdb;
        $subs_table = $wpdb->prefix . 'subscriptions';

        if ($wpdb->get_var("SHOW TABLES LIKE '$subs_table'") !== $subs_table) {
            update_user_meta($user_id, 'asadmindset_trial_expiry', date('Y-m-d H:i:s', strtotime("+{$duration_days} days")));
            update_user_meta($user_id, 'asadmindset_has_active_subscription', 1);
            return;
        }

        // چک per-product: اگه برای همین محصول خرید پولی داشته → تریال نده
        $had_paid_for_product = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $subs_table 
             WHERE user_id=%d 
               AND amount > 0
               AND status IN ('approved','pending')
             LIMIT 1",
            $user_id
        ));
        if ($had_paid_for_product) return;

        // همین پلن مشخص قبلاً داده شده؟
        $already_trial = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $subs_table 
             WHERE user_id=%d AND admin_note=%s LIMIT 1",
            $user_id,
            'تریال خودکار: ' . $plan_name
        ));
        if ($already_trial) return;

        $now    = current_time('mysql');
        $expiry = date('Y-m-d H:i:s', strtotime("+{$duration_days} days"));

        $wpdb->insert(
            $subs_table,
            [
                'user_id'    => $user_id,
                'plan_type'  => 'trial',
                'amount'     => 0,
                'network'    => 'trial',
                'tx_hash'    => 'TRIAL-' . $user_id . '-' . time(),
                'status'     => 'approved',
                'started_at' => $now,
                'expires_at' => $expiry,
                'approved_at'=> $now,
                'is_manual'  => 1,
                'admin_note' => 'تریال خودکار: ' . $plan_name,
                'created_at' => $now,
            ],
            ['%d','%s','%f','%s','%s','%s','%s','%s','%s','%d','%s','%s']
        );

        // ارسال پیام فعال‌سازی در چت پشتیبانی
        self::send_trial_chat_message($user_id, $plan_name, $product, $duration_days, $now, $expiry);

        // ذخیره notification برای نمایش Toast در frontend (آرایه برای چند پلن)
        $existing = get_user_meta($user_id, 'pending_trial_notification', true);
        $notifs = $existing ? json_decode($existing, true) : [];
        if (!is_array($notifs)) $notifs = [];
        $notifs[] = [
            'plan_name'    => $plan_name,
            'duration_days'=> $duration_days,
            'product'      => $product,
            'start'        => date('Y/m/d', strtotime($now)),
            'expiry'       => date('Y/m/d', strtotime($expiry)),
        ];
        update_user_meta($user_id, 'pending_trial_notification', json_encode($notifs, JSON_UNESCAPED_UNICODE));
    }

    /**
     * ارسال پیام فعال‌سازی تریال در Support Chat
     */
    private static function send_trial_chat_message(int $user_id, string $plan_name, string $product, int $duration_days, string $start, string $expiry) {
        global $wpdb;
        $table_conv = $wpdb->prefix . 'support_conversations';
        $table_msg  = $wpdb->prefix . 'support_messages';

        if ($wpdb->get_var("SHOW TABLES LIKE '$table_conv'") !== $table_conv) return;

        // گرفتن یا ساخت conversation
        $conv = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM $table_conv WHERE user_id = %d ORDER BY id DESC LIMIT 1",
            $user_id
        ));

        if (!$conv) {
            $wpdb->insert($table_conv, ['user_id' => $user_id, 'status' => 'open']);
            $conv_id = $wpdb->insert_id;
        } else {
            $conv_id = $conv->id;
        }

        // فرمت تاریخ میلادی
        $start_fmt  = date('Y/m/d', strtotime($start));
        $expiry_fmt = date('Y/m/d', strtotime($expiry));

        $product_label = [
            'alpha_channel' => 'کانال آلفا',
            'academy'       => 'آکادمی',
            'ai_chat'       => 'هوش مصنوعی',
        ][$product] ?? $product;

        $duration_text = $duration_days === 7 ? 'یک هفته'
            : ($duration_days === 30 ? 'یک ماه'
            : "{$duration_days} روز");

        $text = "شما می‌توانید به مدت {$duration_text} از {$product_label} استفاده کنید\n\n"
              . "📅 از: {$start_fmt}\n"
              . "📅 تا: {$expiry_fmt}";

        $wpdb->insert($table_msg, [
            'conversation_id' => $conv_id,
            'sender_type'     => 'admin',
            'sender_id'       => 0,
            'message_type'    => 'text',
            'content'         => $text,
            'status'          => 'sent',
            'created_at'      => current_time('mysql'),
        ]);

        // Pusher notification
        if (class_exists('AsadMindset_Support')) {
            $instance = AsadMindset_Support::get_instance();
            $instance->trigger_pusher_event('conversation-' . $conv_id, 'new-message', [
                'id'        => $wpdb->insert_id,
                'type'      => 'text',
                'content'   => $text,
                'sender'    => 'admin',
                'createdAt' => current_time('mysql'),
            ]);
        }
    }
}

// ── Hook registration ──
add_action('user_register', ['AsadMindset_Trial', 'grant_on_register'], 20, 1);
add_action('rest_api_init', ['AsadMindset_Trial', 'register_routes']);

// ── Create table on load (safe with IF NOT EXISTS) ──
add_action('init', function () {
    static $done = false;
    if ($done) return;
    $done = true;
    // فقط یه بار بعد از اینکه پلاگین لود شد جدول می‌سازیم
    if (!get_option('asadmindset_trial_table_v2')) {
        AsadMindset_Trial::create_tables();
        update_option('asadmindset_trial_table_v2', 1);
    }
}, 20);