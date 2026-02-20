<?php
/**
 * Email Verification Module
 * Handles user registration with email verification (4-digit code + magic link)
 */

if (!defined('ABSPATH')) {
    exit;
}

class AsadMindset_Email_Verification {

    private static $instance = null;

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function __construct() {
        register_activation_hook(
            plugin_dir_path(__FILE__) . 'asadmindset-support.php',
            array($this, 'create_tables')
        );
        add_action('rest_api_init', array($this, 'register_routes'));
        // Create tables if not exists on init
        add_action('init', array($this, 'maybe_create_tables'));
    }

    /**
     * Create verification table
     */
    public function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'email_verifications';

        $sql = "CREATE TABLE IF NOT EXISTS $table (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            email varchar(200) NOT NULL,
            code varchar(4) NOT NULL,
            token varchar(64) NOT NULL,
            expires_at datetime NOT NULL,
            verified_at datetime DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY token (token),
            KEY expires_at (expires_at)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    public function maybe_create_tables() {
        global $wpdb;
        $table = $wpdb->prefix . 'email_verifications';
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            $this->create_tables();
        }
    }

    /**
     * Register REST API routes
     */
    public function register_routes() {
        $ns = 'asadmindset/v1';

        // Register new user
        register_rest_route($ns, '/register', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'register_user'),
            'permission_callback' => '__return_true',
        ));

        // Verify with 4-digit code
        register_rest_route($ns, '/verify-code', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'verify_code'),
            'permission_callback' => '__return_true',
        ));

        // Verify via magic link (GET) - opens in browser
        register_rest_route($ns, '/verify-email', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'verify_email_link'),
            'permission_callback' => '__return_true',
        ));

        // Resend verification email
        register_rest_route($ns, '/resend-verification', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'resend_verification'),
            'permission_callback' => '__return_true',
        ));
    }

    /**
     * Delete unverified accounts older than 24 hours
     * Safe: only deletes accounts where email_verified = 0 AND created > 24h ago
     */
    private function cleanup_unverified_accounts() {
        global $wpdb;
        $table_v = $wpdb->prefix . 'email_verifications';

        // Find user IDs that are unverified AND have no pending verification token
        // (token expires after 1h, so after 24h they're definitely abandoned)
        $cutoff = gmdate('Y-m-d H:i:s', strtotime('-24 hours'));

        $unverified_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT u.ID FROM {$wpdb->users} u
             INNER JOIN {$wpdb->usermeta} um ON um.user_id = u.ID AND um.meta_key = 'email_verified' AND um.meta_value = '0'
             WHERE u.user_registered < %s",
            $cutoff
        ));

        if (!empty($unverified_ids)) {
            require_once(ABSPATH . 'wp-admin/includes/user.php');
            foreach ($unverified_ids as $uid) {
                // Double-check: make sure not verified
                $v = get_user_meta((int)$uid, 'email_verified', true);
                if ($v !== '1') {
                    wp_delete_user((int)$uid);
                }
            }
        }
    }

    /**
     * Register user and send verification email
     */
    public function register_user($request) {
        $params = $request->get_json_params();

        $username = isset($params['username']) ? sanitize_user(trim($params['username'])) : '';
        $email    = isset($params['email'])    ? sanitize_email(trim($params['email']))   : '';
        $password = isset($params['password']) ? $params['password']                     : '';

        // Validate inputs
        if (empty($username) || empty($email) || empty($password)) {
            return new WP_Error('missing_fields', 'لطفاً همه فیلدها را پر کنید.', array('status' => 400));
        }

        if (!is_email($email)) {
            return new WP_Error('invalid_email', 'ایمیل معتبر نیست.', array('status' => 400));
        }

        if (strlen($password) < 6) {
            return new WP_Error('weak_password', 'رمز عبور باید حداقل ۶ کاراکتر باشد.', array('status' => 400));
        }

        // ── Cleanup: delete unverified accounts older than 24h ──────────────
        // This allows users to re-register with the same username/email if they
        // never verified. Verified accounts are never touched.
        $this->cleanup_unverified_accounts();

        // Check if username belongs to a VERIFIED account
        $existing_by_username = get_user_by('login', $username);
        if ($existing_by_username) {
            $verified_u = get_user_meta($existing_by_username->ID, 'email_verified', true);
            if ($verified_u === '1') {
                return new WP_Error('username_exists', 'این نام کاربری قبلاً ثبت شده است.', array('status' => 409));
            }
            // Unverified account with this username — delete it so we can re-register
            require_once(ABSPATH . 'wp-admin/includes/user.php');
            wp_delete_user($existing_by_username->ID);
        }

        // Check if email belongs to a VERIFIED account
        if (email_exists($email)) {
            $existing_user = get_user_by('email', $email);
            if ($existing_user) {
                $verified = get_user_meta($existing_user->ID, 'email_verified', true);
                if ($verified === '1') {
                    return new WP_Error('email_exists', 'این ایمیل قبلاً ثبت شده است.', array('status' => 409));
                }
                // Unverified account — delete and let them re-register fresh
                require_once(ABSPATH . 'wp-admin/includes/user.php');
                wp_delete_user($existing_user->ID);
            }
        }

        // Create user — set as inactive until verified
        $user_id = wp_create_user($username, $password, $email);

        if (is_wp_error($user_id)) {
            return new WP_Error('register_failed', $user_id->get_error_message(), array('status' => 500));
        }

        // Mark as unverified
        update_user_meta($user_id, 'email_verified', '0');

        // Prevent login until verified (set role to none temporarily)
        $user = new WP_User($user_id);
        $user->set_role('');

        // Send verification email
        $sent = $this->send_verification_email($user_id, $email);

        if (!$sent) {
            // Still return success — user can resend
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'حساب ایجاد شد ولی ارسال ایمیل با مشکل مواجه شد. لطفاً دوباره تلاش کنید.',
                'userId'  => $user_id,
                'email'   => $email,
                'needsVerification' => true,
            ));
        }

        // Get the token we just created so React can subscribe to Pusher channel
        global $wpdb;
        $table = $wpdb->prefix . 'email_verifications';
        $verify_token = $wpdb->get_var($wpdb->prepare(
            "SELECT token FROM $table WHERE user_id = %d AND verified_at IS NULL ORDER BY id DESC LIMIT 1",
            $user_id
        ));

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'ثبت‌نام موفق! کد تأیید به ایمیلتان ارسال شد.',
            'userId'  => $user_id,
            'email'   => $email,
            'verifyToken' => $verify_token,
            'needsVerification' => true,
        ));
    }

    /**
     * Send verification email with 4-digit code + magic link
     */
    private function send_verification_email($user_id, $email) {
        global $wpdb;
        $table = $wpdb->prefix . 'email_verifications';

        // Delete old unverified tokens for this user
        $wpdb->delete($table, array('user_id' => $user_id, 'verified_at' => null));

        // Generate 4-digit code
        $code = str_pad(random_int(1000, 9999), 4, '0', STR_PAD_LEFT);

        // Generate unique token for magic link
        $token = bin2hex(random_bytes(32));

        // Expire in 15 minutes
        $expires_at = gmdate('Y-m-d H:i:s', time() + 900);

        $wpdb->insert($table, array(
            'user_id'    => $user_id,
            'email'      => $email,
            'code'       => $code,
            'token'      => $token,
            'expires_at' => $expires_at,
        ));

        // Build magic link — opens verify page, triggers Pusher
        $magic_link = 'https://asadmindset.com/wp-json/asadmindset/v1/verify-email?token=' . $token;

        $subject = 'کد تأیید AsadMindset';

        // Split code into individual digits for display
        $d1 = $code[0]; $d2 = $code[1]; $d3 = $code[2]; $d4 = $code[3];

        $message = '<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>کد تأیید AsadMindset</title>
</head>
<body style="margin:0;padding:0;background:#e8e8e8;font-family:Tahoma,Arial,sans-serif;direction:rtl;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8e8e8;">
<tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#1a1200 0%,#2d1f00 100%);border-radius:24px 24px 0 0;padding:28px 40px;text-align:center;border:1px solid rgba(212,175,55,0.25);border-bottom:none;">
      <table cellpadding="0" cellspacing="0" align="center">
        <tr>
          <td style="vertical-align:middle;">
            <img src="https://app.asadmindset.com/cutify-icon.png" alt="AsadMindset" width="52" height="52"
              style="display:block;border-radius:14px;border:1px solid rgba(212,175,55,0.3);" />
          </td>
          <td width="12"></td>
          <td style="font-size:26px;font-weight:900;color:#d4af37;letter-spacing:-0.5px;vertical-align:middle;">AsadMindset</td>
        </tr>
      </table>
      <p style="margin:10px 0 0;font-size:11px;color:rgba(212,175,55,0.4);letter-spacing:2px;">تأیید هویت</p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#111008;padding:40px 40px 32px;border-left:1px solid rgba(212,175,55,0.15);border-right:1px solid rgba(212,175,55,0.15);">

      <p style="margin:0 0 8px;font-size:16px;color:rgba(255,255,255,0.9);font-weight:700;">سلام 👋</p>
      <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.4);line-height:1.9;">
        برای تکمیل ثبت‌نام در AsadMindset، یکی از دو روش زیر را انتخاب کنید:
      </p>

      <!-- Code box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:linear-gradient(135deg,rgba(212,175,55,0.08) 0%,rgba(184,134,11,0.04) 100%);border:1px dashed rgba(212,175,55,0.4);border-radius:18px;padding:28px 24px;text-align:center;">
            <p style="margin:0 0 16px;font-size:11px;color:rgba(212,175,55,0.5);letter-spacing:2px;">روش اول — کد ۴ رقمی</p>
            <table cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px;">
              <tr>
                <td style="width:56px;height:64px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.35);border-radius:14px;text-align:center;vertical-align:middle;font-size:32px;font-weight:900;color:#d4af37;font-family:Courier New,monospace;">' . $d1 . '</td>
                <td width="10"></td>
                <td style="width:56px;height:64px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.35);border-radius:14px;text-align:center;vertical-align:middle;font-size:32px;font-weight:900;color:#d4af37;font-family:Courier New,monospace;">' . $d2 . '</td>
                <td width="10"></td>
                <td style="width:56px;height:64px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.35);border-radius:14px;text-align:center;vertical-align:middle;font-size:32px;font-weight:900;color:#d4af37;font-family:Courier New,monospace;">' . $d3 . '</td>
                <td width="10"></td>
                <td style="width:56px;height:64px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.35);border-radius:14px;text-align:center;vertical-align:middle;font-size:32px;font-weight:900;color:#d4af37;font-family:Courier New,monospace;">' . $d4 . '</td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">این کد را در برنامه وارد کنید</p>
          </td>
        </tr>
      </table>

      <!-- Divider -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="border-top:1px solid rgba(255,255,255,0.06);"></td>
          <td width="48" style="text-align:center;color:rgba(255,255,255,0.2);font-size:12px;white-space:nowrap;padding:0 12px;">— یا —</td>
          <td style="border-top:1px solid rgba(255,255,255,0.06);"></td>
        </tr>
      </table>

      <!-- Magic link -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <p style="margin:0 0 14px;font-size:11px;color:rgba(212,175,55,0.5);letter-spacing:2px;">روش دوم — لینک مستقیم</p>
            <a href="' . $magic_link . '" style="display:inline-block;background:linear-gradient(135deg,#d4af37 0%,#b8860b 100%);color:#0a0800;text-decoration:none;padding:16px 48px;border-radius:14px;font-size:16px;font-weight:900;font-family:Tahoma,Arial,sans-serif;box-shadow:0 8px 24px rgba(212,175,55,0.3);">&#9989;&nbsp; تأیید با کلیک روی این لینک</a>
            <p style="margin:12px 0 0;font-size:11px;color:rgba(255,255,255,0.2);">با کلیک، برنامه به طور خودکار وارد می‌شود</p>
          </td>
        </tr>
      </table>

      <!-- Expire -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 20px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">&#9201; این کد و لینک تا <span style="color:rgba(212,175,55,0.6);font-weight:700;">۱۵ دقیقه</span> اعتبار دارد</p>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#0d0b00;border-radius:0 0 24px 24px;padding:24px 40px;text-align:center;border:1px solid rgba(212,175,55,0.15);border-top:1px solid rgba(255,255,255,0.04);">
      <table width="60" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:16px;">
        <tr><td height="1" style="background:linear-gradient(90deg,transparent,#d4af37,transparent);"></td></tr>
      </table>
      <p style="margin:0 0 6px;font-size:11px;color:rgba(212,175,55,0.4);letter-spacing:2px;">AsadMindset</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15);line-height:1.7;">
        اگر این ایمیل را شما درخواست نکرده‌اید، آن را نادیده بگیرید.<br>
        &copy; 2025 AsadMindset. تمام حقوق محفوظ است.
      </p>
    </td>
  </tr>

  <tr><td height="32"></td></tr>
</table>
</td></tr>
</table>
</body>
</html>';

        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: AsadMindset <noreply@asadmindset.com>',
        );

        return wp_mail($email, $subject, $message, $headers);
    }

    /**
     * Verify 4-digit code (called from app)
     */
    public function verify_code($request) {
        global $wpdb;
        $params = $request->get_json_params();

        $user_id = isset($params['userId']) ? (int) $params['userId'] : 0;
        $code    = isset($params['code'])   ? sanitize_text_field(trim($params['code'])) : '';

        if (!$user_id || empty($code)) {
            return new WP_Error('missing_fields', 'اطلاعات ناقص است.', array('status' => 400));
        }

        $table = $wpdb->prefix . 'email_verifications';

        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE user_id = %d AND code = %s AND verified_at IS NULL AND expires_at > %s ORDER BY id DESC LIMIT 1",
            $user_id,
            $code,
            gmdate('Y-m-d H:i:s')
        ));

        if (!$row) {
            return new WP_Error('invalid_code', 'کد اشتباه یا منقضی شده است.', array('status' => 400));
        }

        // Mark as verified
        $this->activate_user($user_id, $row->id, $table);

        // Generate JWT and return login data
        return $this->generate_login_response($user_id);
    }

    /**
     * Verify via magic link — opens in browser, fires Pusher event
     */
    public function verify_email_link($request) {
        global $wpdb;

        $token = $request->get_param('token');

        if (empty($token)) {
            return $this->html_response('❌ لینک نامعتبر است.', false);
        }

        $table = $wpdb->prefix . 'email_verifications';

        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE token = %s AND verified_at IS NULL AND expires_at > %s LIMIT 1",
            $token,
            gmdate('Y-m-d H:i:s')
        ));

        if (!$row) {
            return $this->html_response('❌ لینک منقضی شده یا قبلاً استفاده شده است.', false);
        }

        // Activate user
        $this->activate_user($row->user_id, $row->id, $table);

        // Generate JWT token for the app
        $login_data = $this->generate_login_data($row->user_id);

        // Fire Pusher event so the app auto-logs in
        $this->fire_pusher_verification($token, $login_data);

        return $this->html_response('✅ ایمیل شما تأیید شد! می‌توانید این پنجره را ببندید.', true);
    }

    /**
     * Resend verification email
     */
    public function resend_verification($request) {
        $params  = $request->get_json_params();
        $user_id = isset($params['userId']) ? (int) $params['userId'] : 0;

        if (!$user_id) {
            return new WP_Error('missing_user', 'شناسه کاربر الزامی است.', array('status' => 400));
        }

        $user = get_user_by('id', $user_id);
        if (!$user) {
            return new WP_Error('user_not_found', 'کاربر یافت نشد.', array('status' => 404));
        }

        // Check if already verified
        $verified = get_user_meta($user_id, 'email_verified', true);
        if ($verified === '1') {
            return new WP_Error('already_verified', 'ایمیل قبلاً تأیید شده است.', array('status' => 400));
        }

        $sent = $this->send_verification_email($user_id, $user->user_email);

        return rest_ensure_response(array(
            'success' => $sent,
            'message' => $sent ? 'ایمیل مجدداً ارسال شد.' : 'خطا در ارسال ایمیل.',
        ));
    }

    /**
     * Activate user account after verification
     */
    private function activate_user($user_id, $verification_id, $table) {
        global $wpdb;

        // Mark verification record as done
        $wpdb->update($table,
            array('verified_at' => gmdate('Y-m-d H:i:s')),
            array('id' => $verification_id)
        );

        // Set email as verified
        update_user_meta($user_id, 'email_verified', '1');

        // Restore subscriber role
        $user = new WP_User($user_id);
        $user->set_role('subscriber');
    }

    /**
     * Generate login response after verification (for code endpoint)
     */
    private function generate_login_response($user_id) {
        $login_data = $this->generate_login_data($user_id);

        return rest_ensure_response(array(
            'success'  => true,
            'verified' => true,
            'token'    => $login_data['token'],
            'user'     => $login_data['user'],
        ));
    }

    /**
     * Generate JWT token and user data
     */
    private function generate_login_data($user_id) {
        $user       = get_user_by('id', $user_id);
        $secret_key = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : 'fallback-secret';

        $issued_at = time();
        $expire    = $issued_at + (DAY_IN_SECONDS * 30);

        $payload = array(
            'iss'  => get_bloginfo('url'),
            'iat'  => $issued_at,
            'exp'  => $expire,
            'data' => array(
                'user' => array('id' => $user_id),
            ),
        );

        $header           = rtrim(strtr(base64_encode(json_encode(array('typ' => 'JWT', 'alg' => 'HS256'))), '+/', '-_'), '=');
        $payload_encoded  = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
        $signature        = rtrim(strtr(base64_encode(hash_hmac('sha256', "$header.$payload_encoded", $secret_key, true)), '+/', '-_'), '=');
        $token            = "$header.$payload_encoded.$signature";

        return array(
            'token' => $token,
            'user'  => array(
                'id'        => $user_id,
                'email'     => $user->user_email,
                'name'      => $user->display_name,
                'nicename'  => $user->user_nicename,
            ),
        );
    }

    /**
     * Fire Pusher event to notify the app (magic link verification)
     */
    private function fire_pusher_verification($token, $login_data) {
        $channel = 'verify-' . $token;
        $event   = 'email-verified';
        $data    = array(
            'verified' => true,
            'token'    => $login_data['token'],
            'user'     => $login_data['user'],
        );

        // Use AsadMindset_Support's trigger method
        $support = AsadMindset_Support::get_instance();
        $support->trigger_pusher_event($channel, $event, $data);
    }

    /**
     * Return HTML response page for magic link
     */
    private function html_response($message, $success) {
        if ($success) {
            $html = '<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AsadMindset — تأیید ایمیل</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Tahoma, Arial, sans-serif;
    background: #0a0800;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px; direction: rtl; overflow: hidden;
  }
  body::before {
    content: ""; position: fixed; top: -30%; left: 50%; transform: translateX(-50%);
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(212,175,55,0.18) 0%, transparent 70%);
    pointer-events: none;
  }
  .card {
    position: relative;
    background: linear-gradient(160deg, #1a1400 0%, #0f0d00 60%, #0a0800 100%);
    border-radius: 32px; padding: 52px 40px 44px; text-align: center;
    max-width: 380px; width: 100%;
    border: 1px solid rgba(212,175,55,0.2);
    box-shadow: 0 0 0 1px rgba(212,175,55,0.06), 0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,215,0,0.1);
    animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(30px) scale(0.96);} to{opacity:1;transform:translateY(0) scale(1);} }
  .card::before, .card::after { content:""; position:absolute; width:60px; height:60px; border-color:rgba(212,175,55,0.25); border-style:solid; }
  .card::before { top:16px; right:16px; border-width:1px 1px 0 0; border-radius:0 8px 0 0; }
  .card::after  { bottom:16px; left:16px; border-width:0 0 1px 1px; border-radius:0 0 0 8px; }
  .brand { display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:36px; }
  .brand-dot { width:8px; height:8px; background:#d4af37; border-radius:50%; box-shadow:0 0 8px #d4af37; }
  .brand-name { font-size:12px; font-weight:700; letter-spacing:3px; color:rgba(212,175,55,0.5); text-transform:uppercase; }
  .icon-wrap { position:relative; width:96px; height:96px; margin:0 auto 28px; }
  .icon-ring  { position:absolute; inset:0; border-radius:50%; border:1px solid rgba(212,175,55,0.3); animation:pulse 2.5s ease-out infinite; }
  .icon-ring2 { position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(212,175,55,0.12); animation:pulse 2.5s ease-out 0.4s infinite; }
  @keyframes pulse { 0%{transform:scale(1);opacity:1;} 100%{transform:scale(1.3);opacity:0;} }
  .icon-bg {
    position:relative; z-index:1; width:96px; height:96px; border-radius:50%;
    background:radial-gradient(circle, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.05) 100%);
    border:1px solid rgba(212,175,55,0.4); display:flex; align-items:center; justify-content:center;
    font-size:44px; box-shadow:0 0 30px rgba(212,175,55,0.2);
    animation:pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both;
  }
  @keyframes pop { from{transform:scale(0.5);opacity:0;} to{transform:scale(1);opacity:1;} }
  h1 {
    font-size:24px; font-weight:900; margin-bottom:12px; line-height:1.3;
    background:linear-gradient(135deg,#ffd700 0%,#d4af37 50%,#b8860b 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    animation:fi 0.5s ease 0.5s both;
  }
  p { color:rgba(255,255,255,0.4); font-size:14px; line-height:1.9; margin-bottom:32px; animation:fi 0.5s ease 0.6s both; }
  @keyframes fi { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
  .badge {
    display:inline-flex; align-items:center; gap:8px;
    background:linear-gradient(135deg,rgba(212,175,55,0.15),rgba(184,134,11,0.08));
    border:1px solid rgba(212,175,55,0.35); color:#d4af37;
    padding:12px 28px; border-radius:50px; font-size:14px; font-weight:700;
    box-shadow:0 4px 20px rgba(212,175,55,0.1);
    animation:fi 0.5s ease 0.7s both;
  }
  .badge-icon { width:18px; height:18px; background:#d4af37; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#0a0800; font-size:10px; font-weight:900; }
  .divider { width:60px; height:1px; background:linear-gradient(90deg,transparent,rgba(212,175,55,0.3),transparent); margin:28px auto 24px; }
  .hint { font-size:11px; color:rgba(255,255,255,0.2); letter-spacing:0.5px; }
</style>
</head>
<body>
<div class="card">
  <div class="brand"><div class="brand-dot"></div><span class="brand-name">AsadMindset</span><div class="brand-dot"></div></div>
  <div class="icon-wrap">
    <div class="icon-ring"></div><div class="icon-ring2"></div>
    <div class="icon-bg">&#127881;</div>
  </div>
  <h1>ایمیل شما تأیید شد!</h1>
  <p>حساب کاربری شما با موفقیت فعال شد.<br>می‌توانید این پنجره را ببندید.</p>
  <div class="badge"><div class="badge-icon">&#10003;</div><span>تأیید موفق</span></div>
  <div class="divider"></div>
  <p class="hint">برنامه به طور خودکار وارد می‌شود</p>
</div>
</body>
</html>';
        } else {
            $html = '<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AsadMindset — خطا</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Tahoma, Arial, sans-serif;
    background: #0a0000;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px; direction: rtl; overflow: hidden;
  }
  body::before {
    content: ""; position: fixed; top: -30%; left: 50%; transform: translateX(-50%);
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%);
    pointer-events: none;
  }
  .card {
    position: relative;
    background: #ffffff;
    border-radius: 32px; padding: 52px 40px 44px; text-align: center;
    max-width: 380px; width: 100%;
    border: 1px solid rgba(220,38,38,0.15);
    box-shadow: 0 0 0 1px rgba(220,38,38,0.05), 0 32px 80px rgba(0,0,0,0.6), 0 4px 20px rgba(220,38,38,0.08);
    animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(30px) scale(0.96);} to{opacity:1;transform:translateY(0) scale(1);} }
  .card::before, .card::after { content:""; position:absolute; width:50px; height:50px; border-color:rgba(220,38,38,0.2); border-style:solid; }
  .card::before { top:16px; right:16px; border-width:1px 1px 0 0; border-radius:0 8px 0 0; }
  .card::after  { bottom:16px; left:16px; border-width:0 0 1px 1px; border-radius:0 0 0 8px; }
  .brand { display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:36px; }
  .brand-dot { width:7px; height:7px; background:#dc2626; border-radius:50%; box-shadow:0 0 6px rgba(220,38,38,0.5); }
  .brand-name { font-size:11px; font-weight:700; letter-spacing:3px; color:rgba(180,30,30,0.5); text-transform:uppercase; }
  .icon-wrap { position:relative; width:92px; height:92px; margin:0 auto 28px; }
  .icon-ring  { position:absolute; inset:0; border-radius:50%; border:1px solid rgba(220,38,38,0.3); animation:pulse 2.5s ease-out infinite; }
  .icon-ring2 { position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(220,38,38,0.12); animation:pulse 2.5s ease-out 0.4s infinite; }
  @keyframes pulse { 0%{transform:scale(1);opacity:1;} 100%{transform:scale(1.3);opacity:0;} }
  .icon-bg {
    position:relative; z-index:1; width:92px; height:92px; border-radius:50%;
    background:radial-gradient(circle, rgba(220,38,38,0.1) 0%, rgba(220,38,38,0.02) 100%);
    border:1px solid rgba(220,38,38,0.25); display:flex; align-items:center; justify-content:center;
    font-size:42px; box-shadow:0 0 24px rgba(220,38,38,0.1);
    animation:pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both;
  }
  @keyframes pop { from{transform:scale(0.5);opacity:0;} to{transform:scale(1);opacity:1;} }
  h1 {
    font-size:22px; font-weight:900; margin-bottom:12px; line-height:1.3;
    background:linear-gradient(135deg,#dc2626 0%,#ef4444 50%,#b91c1c 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    animation:fi 0.5s ease 0.5s both;
  }
  p { font-size:14px; line-height:1.9; margin-bottom:28px; color:rgba(120,40,40,0.55); animation:fi 0.5s ease 0.6s both; }
  @keyframes fi { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
  .badge {
    display:inline-flex; align-items:center; gap:8px;
    background:linear-gradient(135deg,rgba(220,38,38,0.08),rgba(153,27,27,0.04));
    border:1px solid rgba(220,38,38,0.25); color:#dc2626;
    padding:11px 26px; border-radius:50px; font-size:14px; font-weight:700;
    box-shadow:0 2px 12px rgba(220,38,38,0.08);
    animation:fi 0.5s ease 0.7s both;
  }
  .badge-icon { width:18px; height:18px; background:#dc2626; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:10px; font-weight:900; }
  .divider { width:50px; height:1px; background:linear-gradient(90deg,transparent,rgba(220,38,38,0.2),transparent); margin:24px auto 20px; }
  .hint { font-size:11px; color:rgba(150,60,60,0.4); letter-spacing:0.3px; }
</style>
</head>
<body>
<div class="card">
  <div class="brand"><div class="brand-dot"></div><span class="brand-name">AsadMindset</span><div class="brand-dot"></div></div>
  <div class="icon-wrap">
    <div class="icon-ring"></div><div class="icon-ring2"></div>
    <div class="icon-bg">&#10060;</div>
  </div>
  <h1>لینک منقضی شده است</h1>
  <p>این لینک قبلاً استفاده شده یا منقضی شده است.<br>لطفاً کد ایمیل را در برنامه وارد کنید.</p>
  <div class="badge"><div class="badge-icon">&#10005;</div><span>لینک نامعتبر</span></div>
  <div class="divider"></div>
  <p class="hint">در صورت نیاز از برنامه کد جدید درخواست کنید</p>
</div>
</body>
</html>';
        }

        if ( ! headers_sent() ) {
            header('Content-Type: text/html; charset=UTF-8');
            header('X-Content-Type-Options: nosniff');
        }
        echo $html;
        exit;
    }
}

// Initialize
AsadMindset_Email_Verification::get_instance();