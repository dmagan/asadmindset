<?php
/**
 * Live Streaming Module
 * لایو استریمینگ با Cloudflare Stream
 */

if (!defined('ABSPATH')) {
    exit;
}

// Cloudflare Stream Configuration
define('CF_ACCOUNT_ID', '7ae441719bad624539839a997e0460f4');
define('CF_API_TOKEN', 'FXXOSXSR3KKkq6lG5PqXiTuxe2s4pdmhiL_5TKro');
define('CF_STREAM_BASE', 'https://api.cloudflare.com/client/v4/accounts/' . CF_ACCOUNT_ID . '/stream');

class AsadMindset_Live {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    /**
     * Create live tables
     */
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // Live streams table
        $table_streams = $wpdb->prefix . 'live_streams';
        $sql_streams = "CREATE TABLE $table_streams (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            title varchar(255) NOT NULL,
            description text,
            cf_live_input_id varchar(255) DEFAULT NULL,
            cf_video_id varchar(255) DEFAULT NULL,
            rtmps_url varchar(500) DEFAULT NULL,
            rtmps_key varchar(500) DEFAULT NULL,
            playback_url varchar(500) DEFAULT NULL,
            playback_hls varchar(500) DEFAULT NULL,
            thumbnail_url varchar(500) DEFAULT NULL,
            status varchar(20) DEFAULT 'idle',
            started_at datetime DEFAULT NULL,
            ended_at datetime DEFAULT NULL,
            viewers_count int(11) DEFAULT 0,
            max_viewers int(11) DEFAULT 0,
            duration int(11) DEFAULT 0,
            is_archived tinyint(1) DEFAULT 1,
            created_by bigint(20) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY status (status),
            KEY created_at (created_at),
            KEY cf_live_input_id (cf_live_input_id)
        ) $charset_collate;";
        
        // Live chat messages table
        $table_chat = $wpdb->prefix . 'live_chat';
        $sql_chat = "CREATE TABLE $table_chat (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            stream_id bigint(20) NOT NULL,
            user_id bigint(20) NOT NULL,
            message text NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY stream_id (stream_id),
            KEY created_at (created_at)
        ) $charset_collate;";
        
        // Live viewers table
        $table_viewers = $wpdb->prefix . 'live_viewers';
        $sql_viewers = "CREATE TABLE $table_viewers (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            stream_id bigint(20) NOT NULL,
            user_id bigint(20) NOT NULL,
            joined_at datetime DEFAULT CURRENT_TIMESTAMP,
            left_at datetime DEFAULT NULL,
            PRIMARY KEY (id),
            KEY stream_id (stream_id),
            KEY user_id (user_id),
            UNIQUE KEY stream_user (stream_id, user_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql_streams);
        dbDelta($sql_chat);
        dbDelta($sql_viewers);
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes() {
        $namespace = 'asadmindset/v1';
        $support = AsadMindset_Support::get_instance();
        
        // ============ Admin Routes ============
        
        // Create live input
        register_rest_route($namespace, '/live/create', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_live'),
            'permission_callback' => array($support, 'check_admin_auth')
        ));
        
        // Start live
        register_rest_route($namespace, '/live/start', array(
            'methods' => 'POST',
            'callback' => array($this, 'start_live'),
            'permission_callback' => array($support, 'check_admin_auth')
        ));
        
        // End live
        register_rest_route($namespace, '/live/end', array(
            'methods' => 'POST',
            'callback' => array($this, 'end_live'),
            'permission_callback' => array($support, 'check_admin_auth')
        ));
        
        // Delete archived live
        register_rest_route($namespace, '/live/delete/(?P<id>\d+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_live'),
            'permission_callback' => array($support, 'check_admin_auth')
        ));
        
        // ============ Public/User Routes ============
        
        // Get current live status (public - no auth needed)
        register_rest_route($namespace, '/live/status', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_live_status'),
            'permission_callback' => '__return_true'
        ));
        
        // Get live stream details for watching
        register_rest_route($namespace, '/live/watch/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_live_watch'),
            'permission_callback' => array($support, 'check_user_auth')
        ));
        
        // Join live (viewer tracking)
        register_rest_route($namespace, '/live/join/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'join_live'),
            'permission_callback' => array($support, 'check_user_auth')
        ));
        
        // Leave live
        register_rest_route($namespace, '/live/leave/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'leave_live'),
            'permission_callback' => array($support, 'check_user_auth')
        ));
        
        // Send chat message
        register_rest_route($namespace, '/live/chat/send', array(
            'methods' => 'POST',
            'callback' => array($this, 'send_chat_message'),
            'permission_callback' => array($support, 'check_user_auth')
        ));
        
        // Get chat messages
        register_rest_route($namespace, '/live/chat/(?P<stream_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_chat_messages'),
            'permission_callback' => array($support, 'check_user_auth')
        ));
        
        // ============ Archive Routes ============
        
        // Get archived lives list
        register_rest_route($namespace, '/live/archive', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_archive'),
            'permission_callback' => array($support, 'check_user_auth')
        ));
        
        // Get single archived live
        register_rest_route($namespace, '/live/archive/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_archive_single'),
            'permission_callback' => array($support, 'check_user_auth')
        ));
    }
    
    // ==========================================
    // Cloudflare Stream API Helpers
    // ==========================================
    
    private function cf_request($endpoint, $method = 'GET', $body = null) {
        $url = CF_STREAM_BASE . $endpoint;
        
        $args = array(
            'method' => $method,
            'headers' => array(
                'Authorization' => 'Bearer ' . CF_API_TOKEN,
                'Content-Type' => 'application/json'
            ),
            'timeout' => 30
        );
        
        if ($body) {
            $args['body'] = json_encode($body);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            return array('success' => false, 'error' => $response->get_error_message());
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $data = json_decode(wp_remote_retrieve_body($response), true);
        
        if ($code >= 200 && $code < 300 && isset($data['success']) && $data['success']) {
            return array('success' => true, 'result' => $data['result']);
        }
        
        $error_msg = 'Cloudflare API error';
        if (isset($data['errors']) && !empty($data['errors'])) {
            $error_msg = $data['errors'][0]['message'] ?? $error_msg;
        }
        
        return array('success' => false, 'error' => $error_msg, 'code' => $code);
    }
    
    private function cf_create_live_input($title) {
        return $this->cf_request('/live_inputs', 'POST', array(
            'meta' => array('name' => $title),
            'recording' => array('mode' => 'automatic')
        ));
    }
    
    private function cf_delete_live_input($input_id) {
        return $this->cf_request('/live_inputs/' . $input_id, 'DELETE');
    }
    
    private function cf_list_live_videos($input_id) {
        return $this->cf_request('/live_inputs/' . $input_id . '/videos');
    }
    
    // ==========================================
    // Admin Endpoints
    // ==========================================
    
    /**
     * POST /live/create - ساخت لایو جدید
     */
    public function create_live($request) {
        global $wpdb;
        $support = AsadMindset_Support::get_instance();
        $user_id = $support->get_user_id_from_request($request);
        
        $title = sanitize_text_field($request->get_param('title'));
        if (empty($title)) {
            $title = 'لایو ' . date_i18n('Y/m/d H:i');
        }
        
        // بررسی وجود لایو فعال
        $table = $wpdb->prefix . 'live_streams';
        $active = $wpdb->get_row("SELECT id FROM $table WHERE status IN ('idle', 'live') LIMIT 1");
        if ($active) {
            return new WP_REST_Response(array(
                'error' => 'یک لایو فعال وجود دارد. ابتدا آن را پایان دهید.',
                'active_id' => $active->id
            ), 400);
        }
        
        // ساخت Live Input در کلادفلر
        $cf_result = $this->cf_create_live_input($title);
        
        if (!$cf_result['success']) {
            return new WP_REST_Response(array(
                'error' => 'خطا در ایجاد لایو: ' . ($cf_result['error'] ?? 'Unknown error')
            ), 500);
        }
        
        $cf_data = $cf_result['result'];
        
        $rtmps_url = $cf_data['rtmps']['url'] ?? '';
        $rtmps_key = $cf_data['rtmps']['streamKey'] ?? '';
        $uid = $cf_data['uid'] ?? '';
        
        // ذخیره در دیتابیس
        $wpdb->insert($table, array(
            'title' => $title,
            'description' => sanitize_textarea_field($request->get_param('description') ?? ''),
            'cf_live_input_id' => $uid,
            'rtmps_url' => $rtmps_url,
            'rtmps_key' => $rtmps_key,
            'playback_hls' => '',
            'status' => 'idle',
            'created_by' => $user_id,
            'created_at' => current_time('mysql')
        ));
        
        $stream_id = $wpdb->insert_id;
        
        return new WP_REST_Response(array(
            'id' => $stream_id,
            'title' => $title,
            'cf_live_input_id' => $uid,
            'rtmps_url' => $rtmps_url,
            'rtmps_key' => $rtmps_key,
            'status' => 'idle'
        ), 200);
    }
    
    /**
     * POST /live/start - شروع لایو
     */
    public function start_live($request) {
        global $wpdb;
        $table = $wpdb->prefix . 'live_streams';
        
        $stream_id = intval($request->get_param('stream_id'));
        
        $stream = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $stream_id));
        if (!$stream) {
            return new WP_REST_Response(array('error' => 'لایو یافت نشد'), 404);
        }
        
        // آپدیت وضعیت
        $wpdb->update($table, array(
            'status' => 'live',
            'started_at' => current_time('mysql')
        ), array('id' => $stream_id));
        
        // اطلاع‌رسانی از طریق Pusher
        $support = AsadMindset_Support::get_instance();
        $support->trigger_pusher_event('live-channel', 'live-started', array(
            'stream_id' => $stream_id,
            'title' => $stream->title,
            'started_at' => current_time('mysql')
        ));
        
        // ارسال پوش نوتیفیکیشن
        $this->send_live_push_notification($stream->title);
        
        return new WP_REST_Response(array(
            'success' => true,
            'stream_id' => $stream_id,
            'status' => 'live'
        ), 200);
    }
    
    /**
     * POST /live/end - پایان لایو
     */
    public function end_live($request) {
        global $wpdb;
        $table = $wpdb->prefix . 'live_streams';
        
        $stream_id = intval($request->get_param('stream_id'));
        
        $stream = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $stream_id));
        if (!$stream) {
            return new WP_REST_Response(array('error' => 'لایو یافت نشد'), 404);
        }
        
        // محاسبه مدت زمان
        $duration = 0;
        if ($stream->started_at) {
            $duration = strtotime(current_time('mysql')) - strtotime($stream->started_at);
        }
        
        // دریافت ویدیوی ضبط شده از کلادفلر
        $cf_video_id = null;
        $thumbnail_url = null;
        $playback_hls = $stream->playback_hls;
        
        if ($stream->cf_live_input_id) {
            $videos = $this->cf_list_live_videos($stream->cf_live_input_id);
            if ($videos['success'] && !empty($videos['result'])) {
                $latest_video = end($videos['result']);
                $cf_video_id = $latest_video['uid'] ?? null;
                $thumbnail_url = $latest_video['thumbnail'] ?? null;
                
                if ($cf_video_id) {
                    $playback_hls = 'https://customer-' . strtolower(substr(CF_ACCOUNT_ID, 0, 10)) . '.cloudflarestream.com/' . $cf_video_id . '/manifest/video.m3u8';
                }
            }
        }
        
        // آپدیت دیتابیس
        $wpdb->update($table, array(
            'status' => 'ended',
            'ended_at' => current_time('mysql'),
            'duration' => $duration,
            'cf_video_id' => $cf_video_id,
            'thumbnail_url' => $thumbnail_url,
            'playback_hls' => $playback_hls
        ), array('id' => $stream_id));
        
        // پاک کردن بیننده‌ها
        $viewers_table = $wpdb->prefix . 'live_viewers';
        $wpdb->update($viewers_table, 
            array('left_at' => current_time('mysql')), 
            array('stream_id' => $stream_id, 'left_at' => null)
        );
        
        // اطلاع‌رسانی Pusher
        $support = AsadMindset_Support::get_instance();
        $support->trigger_pusher_event('live-channel', 'live-ended', array(
            'stream_id' => $stream_id,
            'title' => $stream->title,
            'duration' => $duration
        ));
        
        return new WP_REST_Response(array(
            'success' => true,
            'stream_id' => $stream_id,
            'duration' => $duration,
            'cf_video_id' => $cf_video_id
        ), 200);
    }
    
    /**
     * DELETE /live/delete/{id} - حذف لایو آرشیو شده
     */
    public function delete_live($request) {
        global $wpdb;
        $table = $wpdb->prefix . 'live_streams';
        $id = intval($request['id']);
        
        $stream = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
        if (!$stream) {
            return new WP_REST_Response(array('error' => 'لایو یافت نشد'), 404);
        }
        
        // حذف از کلادفلر
        if ($stream->cf_live_input_id) {
            $this->cf_delete_live_input($stream->cf_live_input_id);
        }
        
        // حذف چت و بیننده‌ها
        $wpdb->delete($wpdb->prefix . 'live_chat', array('stream_id' => $id));
        $wpdb->delete($wpdb->prefix . 'live_viewers', array('stream_id' => $id));
        $wpdb->delete($table, array('id' => $id));
        
        return new WP_REST_Response(array('success' => true), 200);
    }
    
    // ==========================================
    // Public/User Endpoints
    // ==========================================
    
    /**
     * GET /live/status - وضعیت لایو (عمومی)
     */
    public function get_live_status($request) {
        global $wpdb;
        $table = $wpdb->prefix . 'live_streams';
        
        $live = $wpdb->get_row("SELECT id, title, status, started_at, viewers_count FROM $table WHERE status = 'live' ORDER BY id DESC LIMIT 1");
        
        if ($live) {
            return new WP_REST_Response(array(
                'is_live' => true,
                'stream_id' => (int) $live->id,
                'title' => $live->title,
                'started_at' => $live->started_at,
                'viewers_count' => (int) $live->viewers_count
            ), 200);
        }
        
        return new WP_REST_Response(array(
            'is_live' => false,
            'stream_id' => null
        ), 200);
    }
    
    /**
     * GET /live/watch/{id} - دریافت اطلاعات لایو برای تماشا
     */
    public function get_live_watch($request) {
        global $wpdb;
        $table = $wpdb->prefix . 'live_streams';
        $id = intval($request['id']);
        
        $stream = $wpdb->get_row($wpdb->prepare(
            "SELECT id, title, description, playback_hls, cf_live_input_id, status, started_at, viewers_count FROM $table WHERE id = %d",
            $id
        ));
        
        if (!$stream) {
            return new WP_REST_Response(array('error' => 'لایو یافت نشد'), 404);
        }
        
        // برای لایو فعال از live input UID استفاده کن
        $playback_hls = $stream->playback_hls;
        if ($stream->status === 'live' && $stream->cf_live_input_id) {
            $playback_hls = 'https://customer-' . strtolower(substr(CF_ACCOUNT_ID, 0, 10)) . '.cloudflarestream.com/' . $stream->cf_live_input_id . '/manifest/video.m3u8';
        }
        
        return new WP_REST_Response(array(
            'id' => (int) $stream->id,
            'title' => $stream->title,
            'description' => $stream->description,
            'playback_hls' => $playback_hls,
            'status' => $stream->status,
            'started_at' => $stream->started_at,
            'viewers_count' => (int) $stream->viewers_count
        ), 200);
    }
    
    /**
     * POST /live/join/{id} - پیوستن به لایو
     */
    public function join_live($request) {
        global $wpdb;
        $support = AsadMindset_Support::get_instance();
        $user_id = $support->get_user_id_from_request($request);
        $stream_id = intval($request['id']);
        
        $table = $wpdb->prefix . 'live_streams';
        $viewers_table = $wpdb->prefix . 'live_viewers';
        
        // Upsert viewer
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM $viewers_table WHERE stream_id = %d AND user_id = %d",
            $stream_id, $user_id
        ));
        
        if ($existing) {
            $wpdb->update($viewers_table, array('left_at' => null, 'joined_at' => current_time('mysql')), array('id' => $existing->id));
        } else {
            $wpdb->insert($viewers_table, array(
                'stream_id' => $stream_id,
                'user_id' => $user_id,
                'joined_at' => current_time('mysql')
            ));
        }
        
        // آپدیت تعداد بیننده
        $count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $viewers_table WHERE stream_id = %d AND left_at IS NULL",
            $stream_id
        ));
        
        $wpdb->query($wpdb->prepare(
            "UPDATE $table SET viewers_count = %d, max_viewers = GREATEST(max_viewers, %d) WHERE id = %d",
            $count, $count, $stream_id
        ));
        
        // اطلاع‌رسانی Pusher
        $support->trigger_pusher_event('live-stream-' . $stream_id, 'viewer-count', array(
            'count' => $count
        ));
        
        return new WP_REST_Response(array('success' => true, 'viewers_count' => $count), 200);
    }
    
    /**
     * POST /live/leave/{id} - ترک لایو
     */
    public function leave_live($request) {
        global $wpdb;
        $support = AsadMindset_Support::get_instance();
        $user_id = $support->get_user_id_from_request($request);
        $stream_id = intval($request['id']);
        
        $table = $wpdb->prefix . 'live_streams';
        $viewers_table = $wpdb->prefix . 'live_viewers';
        
        $wpdb->update($viewers_table, 
            array('left_at' => current_time('mysql')), 
            array('stream_id' => $stream_id, 'user_id' => $user_id, 'left_at' => null)
        );
        
        $count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $viewers_table WHERE stream_id = %d AND left_at IS NULL",
            $stream_id
        ));
        
        $wpdb->query($wpdb->prepare(
            "UPDATE $table SET viewers_count = %d WHERE id = %d",
            $count, $stream_id
        ));
        
        $support->trigger_pusher_event('live-stream-' . $stream_id, 'viewer-count', array(
            'count' => $count
        ));
        
        return new WP_REST_Response(array('success' => true, 'viewers_count' => $count), 200);
    }
    
    // ==========================================
    // Chat Endpoints
    // ==========================================
    
    /**
     * POST /live/chat/send - ارسال پیام چت
     */
    public function send_chat_message($request) {
        global $wpdb;
        $support = AsadMindset_Support::get_instance();
        $user_id = $support->get_user_id_from_request($request);
        
        $stream_id = intval($request->get_param('stream_id'));
        $message = sanitize_text_field($request->get_param('message'));
        
        if (empty($message)) {
            return new WP_REST_Response(array('error' => 'پیام نمیتواند خالی باشد'), 400);
        }
        
        if (mb_strlen($message) > 500) {
            return new WP_REST_Response(array('error' => 'پیام بیش از حد طولانی است'), 400);
        }
        
        // بررسی فعال بودن لایو
        $table = $wpdb->prefix . 'live_streams';
        $stream = $wpdb->get_row($wpdb->prepare("SELECT status FROM $table WHERE id = %d", $stream_id));
        if (!$stream || $stream->status !== 'live') {
            return new WP_REST_Response(array('error' => 'لایو فعال نیست'), 400);
        }
        
        // دریافت اطلاعات کاربر
        $user = get_user_by('id', $user_id);
        $display_name = $user ? $user->display_name : 'کاربر';
        $is_admin = $user && user_can($user, 'manage_options');
        
        // ذخیره پیام
        $chat_table = $wpdb->prefix . 'live_chat';
        $wpdb->insert($chat_table, array(
            'stream_id' => $stream_id,
            'user_id' => $user_id,
            'message' => $message,
            'created_at' => current_time('mysql')
        ));
        
        $msg_id = $wpdb->insert_id;
        
        // ارسال از طریق Pusher
        $chat_data = array(
            'id' => $msg_id,
            'stream_id' => $stream_id,
            'user_id' => $user_id,
            'display_name' => $display_name,
            'is_admin' => $is_admin,
            'message' => $message,
            'created_at' => current_time('mysql')
        );
        
        $support->trigger_pusher_event('live-chat-' . $stream_id, 'new-message', $chat_data);
        
        return new WP_REST_Response($chat_data, 200);
    }
    
    /**
     * GET /live/chat/{stream_id} - دریافت پیام‌های چت
     */
    public function get_chat_messages($request) {
        global $wpdb;
        $stream_id = intval($request['stream_id']);
        $before_id = intval($request->get_param('before') ?? 0);
        $limit = min(intval($request->get_param('limit') ?? 50), 100);
        
        $chat_table = $wpdb->prefix . 'live_chat';
        
        $where = $wpdb->prepare("WHERE stream_id = %d", $stream_id);
        if ($before_id > 0) {
            $where .= $wpdb->prepare(" AND id < %d", $before_id);
        }
        
        $messages = $wpdb->get_results(
            "SELECT id, stream_id, user_id, message, created_at
             FROM $chat_table
             $where
             ORDER BY id DESC
             LIMIT $limit"
        );
        
        $result = array();
        foreach (array_reverse($messages) as $msg) {
            $user = get_user_by('id', $msg->user_id);
            $result[] = array(
                'id' => (int) $msg->id,
                'stream_id' => (int) $msg->stream_id,
                'user_id' => (int) $msg->user_id,
                'display_name' => $user ? $user->display_name : 'کاربر',
                'is_admin' => $user && user_can($user, 'manage_options'),
                'message' => $msg->message,
                'created_at' => $msg->created_at
            );
        }
        
        return new WP_REST_Response($result, 200);
    }
    
    // ==========================================
    // Archive Endpoints
    // ==========================================
    
    /**
     * GET /live/archive - لیست لایوهای آرشیو شده
     */
    public function get_archive($request) {
        global $wpdb;
        $table = $wpdb->prefix . 'live_streams';
        
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = min(intval($request->get_param('per_page') ?? 20), 50);
        $offset = ($page - 1) * $per_page;
        
        $streams = $wpdb->get_results($wpdb->prepare(
            "SELECT id, title, description, thumbnail_url, playback_hls, cf_video_id, 
                    started_at, ended_at, duration, max_viewers, created_at
             FROM $table
             WHERE status = 'ended' AND is_archived = 1
             ORDER BY ended_at DESC
             LIMIT %d OFFSET %d",
            $per_page, $offset
        ));
        
        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table WHERE status = 'ended' AND is_archived = 1");
        
        $result = array();
        foreach ($streams as $s) {
            $result[] = array(
                'id' => (int) $s->id,
                'title' => $s->title,
                'description' => $s->description,
                'thumbnail_url' => $s->thumbnail_url,
                'playback_hls' => $s->playback_hls,
                'has_video' => !empty($s->cf_video_id),
                'started_at' => $s->started_at,
                'ended_at' => $s->ended_at,
                'duration' => (int) $s->duration,
                'max_viewers' => (int) $s->max_viewers
            );
        }
        
        return new WP_REST_Response(array(
            'streams' => $result,
            'total' => $total,
            'page' => $page,
            'per_page' => $per_page
        ), 200);
    }
    
    /**
     * GET /live/archive/{id} - دریافت تکی لایو آرشیو شده
     */
    public function get_archive_single($request) {
        global $wpdb;
        $table = $wpdb->prefix . 'live_streams';
        $id = intval($request['id']);
        
        $stream = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d AND status = 'ended'", $id
        ));
        
        if (!$stream) {
            return new WP_REST_Response(array('error' => 'لایو یافت نشد'), 404);
        }
        
        $playback_hls = $stream->playback_hls;
        if ($stream->cf_video_id) {
            $playback_hls = 'https://customer-' . strtolower(substr(CF_ACCOUNT_ID, 0, 10)) . '.cloudflarestream.com/' . $stream->cf_video_id . '/manifest/video.m3u8';
        }
        
        return new WP_REST_Response(array(
            'id' => (int) $stream->id,
            'title' => $stream->title,
            'description' => $stream->description,
            'playback_hls' => $playback_hls,
            'thumbnail_url' => $stream->thumbnail_url,
            'duration' => (int) $stream->duration,
            'max_viewers' => (int) $stream->max_viewers,
            'started_at' => $stream->started_at,
            'ended_at' => $stream->ended_at
        ), 200);
    }
    
    // ==========================================
    // Push Notification
    // ==========================================
    
    private function send_live_push_notification($title) {
        try {
            $push = new AsadMindset_Push_Notifications();
            
            global $wpdb;
            $tokens_table = $wpdb->prefix . 'push_tokens';
            $user_ids = $wpdb->get_col("SELECT DISTINCT user_id FROM $tokens_table");
            
            foreach ($user_ids as $uid) {
                $push->send_to_user(
                    (int) $uid,
                    '🔴 لایو شروع شد!',
                    $title,
                    array('type' => 'live_started')
                );
            }
        } catch (Exception $e) {
            error_log('Live push notification error: ' . $e->getMessage());
        }
    }
}

// Initialize
AsadMindset_Live::get_instance();

// Create tables on activation
register_activation_hook(plugin_dir_path(__FILE__) . 'asadmindset-support.php', array('AsadMindset_Live', 'create_tables'));