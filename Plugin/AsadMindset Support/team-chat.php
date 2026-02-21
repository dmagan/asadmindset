<?php
/**
 * Team Chat Module for AsadMindset
 * Internal messaging between admin and sub-admins (DM + Group)
 * Uses Pusher for real-time messaging
 */

if (!defined('ABSPATH')) {
    exit;
}

class AsadMindset_TeamChat {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
        add_action('init', array($this, 'maybe_create_tables'));
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    // ─── Tables ───────────────────────────────────────────────────────────
    
    public function maybe_create_tables() {
        global $wpdb;
        $table = $wpdb->prefix . 'team_conversations';
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") != $table) {
            $this->create_tables();
        } else {
            // Run migrations for new columns on existing tables
            $t3 = $wpdb->prefix . 'team_messages';
            $col = $wpdb->get_results("SHOW COLUMNS FROM $t3 LIKE 'translated_content'");
            if (empty($col)) {
                $wpdb->query("ALTER TABLE $t3 ADD COLUMN translated_content text DEFAULT NULL AFTER reply_to_id");
            }
            $col2 = $wpdb->get_results("SHOW COLUMNS FROM $t3 LIKE 'sender_lang'");
            if (empty($col2)) {
                $wpdb->query("ALTER TABLE $t3 ADD COLUMN sender_lang varchar(5) DEFAULT 'fa' AFTER translated_content");
            }
            $col3 = $wpdb->get_results("SHOW COLUMNS FROM $t3 LIKE 'translated_voice'");
            if (empty($col3)) {
                $wpdb->query("ALTER TABLE $t3 ADD COLUMN translated_voice tinyint(1) DEFAULT 0 AFTER sender_lang");
            }
            $col4 = $wpdb->get_results("SHOW COLUMNS FROM $t3 LIKE 'original_text'");
            if (empty($col4)) {
                $wpdb->query("ALTER TABLE $t3 ADD COLUMN original_text text DEFAULT NULL AFTER translated_voice");
            }
            $col5 = $wpdb->get_results("SHOW COLUMNS FROM $t3 LIKE 'original_audio_url'");
            if (empty($col5)) {
                $wpdb->query("ALTER TABLE $t3 ADD COLUMN original_audio_url varchar(500) DEFAULT NULL AFTER original_text");
            }
        }
    }
    
    public function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        
        // Team conversations (DM or Group)
        $t1 = $wpdb->prefix . 'team_conversations';
        $sql1 = "CREATE TABLE IF NOT EXISTS $t1 (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            type varchar(10) NOT NULL DEFAULT 'direct',
            name varchar(200) DEFAULT NULL,
            avatar_url varchar(500) DEFAULT NULL,
            created_by bigint(20) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY type (type),
            KEY created_by (created_by)
        ) $charset_collate;";
        
        // Members of each conversation
        $t2 = $wpdb->prefix . 'team_conversation_members';
        $sql2 = "CREATE TABLE IF NOT EXISTS $t2 (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            conversation_id bigint(20) NOT NULL,
            user_id bigint(20) NOT NULL,
            role varchar(20) DEFAULT 'member',
            last_read_at datetime DEFAULT NULL,
            joined_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY conv_user (conversation_id, user_id),
            KEY conversation_id (conversation_id),
            KEY user_id (user_id)
        ) $charset_collate;";
        
        // Team messages — all columns defined here, no need for ALTER after create
        $t3 = $wpdb->prefix . 'team_messages';
        $sql3 = "CREATE TABLE IF NOT EXISTS $t3 (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            conversation_id bigint(20) NOT NULL,
            sender_id bigint(20) NOT NULL,
            message_type varchar(20) DEFAULT 'text',
            content text,
            media_url varchar(500) DEFAULT NULL,
            duration int(11) DEFAULT 0,
            is_edited tinyint(1) DEFAULT 0,
            reply_to_id bigint(20) DEFAULT NULL,
            translated_content text DEFAULT NULL,
            sender_lang varchar(5) DEFAULT 'fa',
            translated_voice tinyint(1) DEFAULT 0,
            original_text text DEFAULT NULL,
            original_audio_url varchar(500) DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY conversation_id (conversation_id),
            KEY sender_id (sender_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql1);
        dbDelta($sql2);
        dbDelta($sql3);
    }
    
    // ─── Auth Helpers ─────────────────────────────────────────────────────
    
    private function get_bearer_token($r) {
        $h = $r->get_header('Authorization');
        if ($h && preg_match('/Bearer\s(\S+)/', $h, $m)) return $m[1];
        return null;
    }
    
    private function validate_jwt_token($token) {
        $sk = defined('JWT_AUTH_SECRET_KEY') ? JWT_AUTH_SECRET_KEY : false;
        if (!$sk) return false;
        try {
            $p = explode('.', $token);
            if (count($p) !== 3) return false;
            $pl = json_decode(base64_decode($p[1]), true);
            if (!$pl || !isset($pl['data']['user']['id'])) return false;
            if (isset($pl['exp']) && $pl['exp'] < time()) return false;
            return $pl['data']['user']['id'];
        } catch (Exception $e) {
            return false;
        }
    }
    
    public function get_user_id_from_request($r) {
        $t = $this->get_bearer_token($r);
        return $this->validate_jwt_token($t);
    }
    
    public function check_team_auth($r) {
        $uid = $this->get_user_id_from_request($r);
        if (!$uid) return false;
        
        $user = get_user_by('id', $uid);
        if ($user && user_can($user, 'manage_options')) return true;
        
        global $wpdb;
        $table = $wpdb->prefix . 'sub_admins';
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT is_active FROM $table WHERE user_id = %d AND is_active = 1", $uid
        ));
        
        return !empty($row);
    }
    
    private function is_conversation_member($conversation_id, $user_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'team_conversation_members';
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM $table WHERE conversation_id = %d AND user_id = %d",
            $conversation_id, $user_id
        ));
        return !empty($row);
    }
    
    private function is_conversation_admin($conversation_id, $user_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'team_conversation_members';
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM $table WHERE conversation_id = %d AND user_id = %d AND role = 'admin'",
            $conversation_id, $user_id
        ));
        return !empty($row);
    }
    
    private function trigger_pusher_event($channel, $event, $data) {
        $support = AsadMindset_Support::get_instance();
        return $support->trigger_pusher_event($channel, $event, $data);
    }
    
    // ─── Routes ───────────────────────────────────────────────────────────
    
    public function register_routes() {
        $ns = 'asadmindset/v1';
        
        register_rest_route($ns, '/team/conversations', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_conversations'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations', [
            'methods'             => 'POST',
            'callback'            => [$this, 'create_conversation'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)/messages', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_messages'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)/message', [
            'methods'             => 'POST',
            'callback'            => [$this, 'send_message'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/messages/(?P<id>\d+)', [
            'methods'             => 'PUT',
            'callback'            => [$this, 'edit_message'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/messages/(?P<id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'delete_message'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)/read', [
            'methods'             => 'POST',
            'callback'            => [$this, 'mark_as_read'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)/typing', [
            'methods'             => 'POST',
            'callback'            => [$this, 'typing_indicator'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/members', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_team_members'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)', [
            'methods'             => 'PUT',
            'callback'            => [$this, 'update_conversation'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)/members', [
            'methods'             => 'POST',
            'callback'            => [$this, 'add_member'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)/members/(?P<user_id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'remove_member'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
        
        register_rest_route($ns, '/team/conversations/(?P<id>\d+)/leave', [
            'methods'             => 'POST',
            'callback'            => [$this, 'leave_conversation'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);

        register_rest_route($ns, '/translate', [
            'methods'             => 'POST',
            'callback'            => [$this, 'translate_message'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);

        register_rest_route($ns, '/team/set-lang', [
            'methods'             => 'POST',
            'callback'            => [$this, 'set_user_lang'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);

        register_rest_route($ns, '/voice/stt', [
            'methods'             => 'POST',
            'callback'            => [$this, 'speech_to_text'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);

        register_rest_route($ns, '/voice/tts', [
            'methods'             => 'POST',
            'callback'            => [$this, 'text_to_speech'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);

        register_rest_route($ns, '/team/messages/(?P<id>\d+)/translation', [
            'methods'             => 'POST',
            'callback'            => [$this, 'save_translation'],
            'permission_callback' => [$this, 'check_team_auth'],
        ]);
    }
    
    // ─── Callbacks ────────────────────────────────────────────────────────
    
    public function get_conversations($r) {
        global $wpdb;
        $uid = $this->get_user_id_from_request($r);
        
        $t_conv    = $wpdb->prefix . 'team_conversations';
        $t_members = $wpdb->prefix . 'team_conversation_members';
        $t_msgs    = $wpdb->prefix . 'team_messages';
        
        $conversations = $wpdb->get_results($wpdb->prepare("
            SELECT c.*, 
                   m.user_id as member_user_id,
                   (SELECT content FROM $t_msgs WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                   (SELECT message_type FROM $t_msgs WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
                   (SELECT sender_id FROM $t_msgs WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender_id,
                   (SELECT created_at FROM $t_msgs WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
                   (SELECT COUNT(*) FROM $t_msgs tm WHERE tm.conversation_id = c.id AND tm.created_at > COALESCE(m.last_read_at, '1970-01-01') AND tm.sender_id != %d) as unread_count
            FROM $t_conv c
            INNER JOIN $t_members m ON m.conversation_id = c.id AND m.user_id = %d
            ORDER BY COALESCE(
                (SELECT created_at FROM $t_msgs WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
                c.created_at
            ) DESC
        ", $uid, $uid));
        
        $result = [];
        foreach ($conversations as $conv) {
            $item = [
                'id'              => (int) $conv->id,
                'type'            => $conv->type,
                'name'            => $conv->name,
                'avatarUrl'       => $conv->avatar_url,
                'createdBy'       => (int) $conv->created_by,
                'lastMessage'     => $conv->last_message,
                'lastMessageType' => $conv->last_message_type,
                'lastMessageAt'   => $conv->last_message_at,
                'unreadCount'     => (int) $conv->unread_count,
                'createdAt'       => $conv->created_at,
                'updatedAt'       => $conv->updated_at,
                'members'         => [],
            ];
            
            if ($conv->last_message_sender_id) {
                $sender = get_userdata((int) $conv->last_message_sender_id);
                $item['lastMessageSenderName'] = $sender ? $sender->display_name : 'ناشناس';
                $item['lastMessageSenderId']   = (int) $conv->last_message_sender_id;
            }
            
            $members = $wpdb->get_results($wpdb->prepare(
                "SELECT user_id, role FROM $t_members WHERE conversation_id = %d",
                $conv->id
            ));
            
            foreach ($members as $mem) {
                $u = get_userdata((int) $mem->user_id);
                $item['members'][] = [
                    'userId'      => (int) $mem->user_id,
                    'displayName' => $u ? $u->display_name : 'ناشناس',
                    'email'       => $u ? $u->user_email : '',
                    'role'        => $mem->role,
                ];
            }
            
            if ($conv->type === 'direct' && count($item['members']) === 2) {
                foreach ($item['members'] as $mem) {
                    if ($mem['userId'] !== $uid) {
                        $item['displayName'] = $mem['displayName'];
                        $item['displayEmail'] = $mem['email'];
                        break;
                    }
                }
            }
            
            $result[] = $item;
        }
        
        return new WP_REST_Response($result, 200);
    }
    
    public function create_conversation($r) {
        global $wpdb;
        $uid    = $this->get_user_id_from_request($r);
        $params = $r->get_json_params();
        
        $type       = isset($params['type'])      ? $params['type']                           : 'direct';
        $name       = isset($params['name'])      ? sanitize_text_field($params['name'])      : null;
        $member_ids = isset($params['memberIds']) ? array_map('intval', $params['memberIds']) : [];
        
        if (empty($member_ids)) {
            return new WP_REST_Response(['message' => 'حداقل یک عضو انتخاب کنید'], 400);
        }
        
        if (!in_array($uid, $member_ids)) {
            $member_ids[] = $uid;
        }
        
        $t_conv    = $wpdb->prefix . 'team_conversations';
        $t_members = $wpdb->prefix . 'team_conversation_members';
        
        if ($type === 'direct' && count($member_ids) === 2) {
            $other_id = $member_ids[0] === $uid ? $member_ids[1] : $member_ids[0];
            
            $existing = $wpdb->get_var($wpdb->prepare("
                SELECT c.id FROM $t_conv c
                INNER JOIN $t_members m1 ON m1.conversation_id = c.id AND m1.user_id = %d
                INNER JOIN $t_members m2 ON m2.conversation_id = c.id AND m2.user_id = %d
                WHERE c.type = 'direct'
                LIMIT 1
            ", $uid, $other_id));
            
            if ($existing) {
                return new WP_REST_Response(['id' => (int) $existing, 'existing' => true], 200);
            }
        }
        
        if ($type === 'group' && empty($name)) {
            return new WP_REST_Response(['message' => 'نام گروه الزامی است'], 400);
        }
        
        $wpdb->insert($t_conv, [
            'type'       => $type,
            'name'       => $name,
            'created_by' => $uid,
            'created_at' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ]);
        $conv_id = $wpdb->insert_id;
        
        foreach ($member_ids as $mid) {
            $role = ($mid === $uid) ? 'admin' : 'member';
            $wpdb->insert($t_members, [
                'conversation_id' => $conv_id,
                'user_id'         => $mid,
                'role'            => $role,
                'joined_at'       => gmdate('Y-m-d H:i:s'),
            ]);
        }
        
        $creator = get_userdata($uid);
        foreach ($member_ids as $mid) {
            if ($mid !== $uid) {
                $this->trigger_pusher_event('team-user-' . $mid, 'new-conversation', [
                    'conversationId' => $conv_id,
                    'type'           => $type,
                    'name'           => $name,
                    'createdBy'      => $uid,
                    'createdByName'  => $creator ? $creator->display_name : 'ناشناس',
                ]);
            }
        }
        
        return new WP_REST_Response(['id' => $conv_id, 'existing' => false], 201);
    }
    
    public function get_messages($r) {
        global $wpdb;
        $uid     = $this->get_user_id_from_request($r);
        $conv_id = (int) $r->get_param('id');
        
        if (!$this->is_conversation_member($conv_id, $uid)) {
            return new WP_REST_Response(['message' => 'دسترسی ندارید'], 403);
        }
        
        $t_msgs    = $wpdb->prefix . 'team_messages';
        $t_conv    = $wpdb->prefix . 'team_conversations';
        $t_members = $wpdb->prefix . 'team_conversation_members';
        
        $conv = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t_conv WHERE id = %d", $conv_id));
        if (!$conv) {
            return new WP_REST_Response(['message' => 'مکالمه یافت نشد'], 404);
        }
        
        $members      = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id, role, last_read_at FROM $t_members WHERE conversation_id = %d", $conv_id
        ));
        $members_list = [];
        foreach ($members as $mem) {
            $u              = get_userdata((int) $mem->user_id);
            $members_list[] = [
                'userId'      => (int) $mem->user_id,
                'displayName' => $u ? $u->display_name : 'ناشناس',
                'email'       => $u ? $u->user_email : '',
                'role'        => $mem->role,
                'lastReadAt'  => $mem->last_read_at,
                'lang'        => get_user_meta((int) $mem->user_id, 'teamchat_lang', true) ?: 'fa',
            ];
        }
        
        $others_read = $wpdb->get_var($wpdb->prepare(
            "SELECT MAX(last_read_at) FROM $t_members WHERE conversation_id = %d AND user_id != %d",
            $conv_id, $uid
        ));
        
        $page     = max(1, (int) $r->get_param('page'));
        $per_page = min(500, max(50, (int) ($r->get_param('per_page') ?? 500)));
        $offset   = ($page - 1) * $per_page;
        
        $total = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $t_msgs WHERE conversation_id = %d", $conv_id
        ));
        
        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $t_msgs WHERE conversation_id = %d ORDER BY created_at ASC LIMIT %d OFFSET %d",
            $conv_id, $per_page, $offset
        ));
        
        $formatted = array_map(function($msg) use ($wpdb, $t_msgs) {
            $sender = get_userdata((int) $msg->sender_id);
            
            $result = [
                'id'               => (int) $msg->id,
                'type'             => $msg->message_type,
                'content'          => $msg->content,
                'translatedContent'=> isset($msg->translated_content)  ? $msg->translated_content    : null,
                'senderLang'       => isset($msg->sender_lang)          ? ($msg->sender_lang ?? 'fa') : 'fa',
                'translatedVoice'  => isset($msg->translated_voice)     ? (bool) $msg->translated_voice : false,
                'originalText'     => isset($msg->original_text)        ? $msg->original_text          : null,
                'originalAudioUrl' => isset($msg->original_audio_url)   ? $msg->original_audio_url     : null,
                'mediaUrl'         => $msg->media_url,
                'duration'         => (int) $msg->duration,
                'senderId'         => (int) $msg->sender_id,
                'senderName'       => $sender ? $sender->display_name : 'ناشناس',
                'isEdited'         => (bool) $msg->is_edited,
                'createdAt'        => $msg->created_at,
                'replyTo'          => null,
            ];
            
            if (!empty($msg->reply_to_id)) {
                $reply = $wpdb->get_row($wpdb->prepare(
                    "SELECT id, message_type, content, sender_id FROM $t_msgs WHERE id = %d",
                    $msg->reply_to_id
                ));
                if ($reply) {
                    $reply_sender      = get_userdata((int) $reply->sender_id);
                    $result['replyTo'] = [
                        'id'         => (int) $reply->id,
                        'type'       => $reply->message_type,
                        'content'    => $reply->content,
                        'senderId'   => (int) $reply->sender_id,
                        'senderName' => $reply_sender ? $reply_sender->display_name : 'ناشناس',
                    ];
                }
            }
            
            return $result;
        }, $messages);
        
        return new WP_REST_Response([
            'conversation' => [
                'id'               => (int) $conv->id,
                'type'             => $conv->type,
                'name'             => $conv->name,
                'avatarUrl'        => $conv->avatar_url,
                'createdBy'        => (int) $conv->created_by,
                'members'          => $members_list,
                'othersLastReadAt' => $others_read,
            ],
            'messages'   => $formatted,
            'total'      => $total,
            'page'       => $page,
            'perPage'    => $per_page,
            'totalPages' => ceil($total / $per_page),
        ], 200);
    }
    
    /**
     * POST /team/conversations/{id}/message — send a message
     *
     * سیستم دو تیک:
     *   تیک اول  → پیام در DB ذخیره شد + Pusher "new-message" با status=sent
     *   تیک دوم  → ترجمه تمام شد + Pusher "message-translated" با status=translated
     *   تیک آبی  → طرف مقابل پیام رو دید (همان mark_as_read موجود)
     *
     * همچنین بعد از تیک دوم، یک event به channel شخصی فرستنده می‌فرستیم
     * تا پیام در چت خود فرستنده هم فوری آپدیت بشه (بدون reload).
     */
    public function send_message($r) {
        global $wpdb;
        $uid     = $this->get_user_id_from_request($r);
        $conv_id = (int) $r->get_param('id');
        $params  = $r->get_json_params();

        if (!$this->is_conversation_member($conv_id, $uid)) {
            return new WP_REST_Response(['message' => 'دسترسی ندارید'], 403);
        }

        $t_msgs    = $wpdb->prefix . 'team_messages';
        $t_conv    = $wpdb->prefix . 'team_conversations';
        $t_members = $wpdb->prefix . 'team_conversation_members';

        $sender_lang = isset($params['senderLang']) ? sanitize_text_field($params['senderLang']) : 'fa';
        $content     = isset($params['content'])    ? $params['content']    : '';
        $msg_type    = isset($params['type'])        ? $params['type']       : 'text';

        // ── STEP 1: Insert پیام بدون ترجمه → تیک اول ────────────────────
        $insert_data = [
            'conversation_id'    => $conv_id,
            'sender_id'          => $uid,
            'message_type'       => $msg_type,
            'content'            => $content,
            'media_url'          => isset($params['mediaUrl'])         ? $params['mediaUrl']         : null,
            'duration'           => isset($params['duration'])         ? (int) $params['duration']   : 0,
            'reply_to_id'        => isset($params['replyToId'])        ? (int) $params['replyToId']  : null,
            'translated_content' => null,            // هنوز ترجمه نشده
            'sender_lang'        => $sender_lang,
            'translated_voice'   => !empty($params['translatedVoice']) ? 1 : 0,
            'original_text'      => isset($params['originalText'])     ? $params['originalText']     : null,
            'original_audio_url' => isset($params['originalAudioUrl']) ? $params['originalAudioUrl'] : null,
            'created_at'         => gmdate('Y-m-d H:i:s'),
        ];

        $db_result = $wpdb->insert($t_msgs, $insert_data);
        if ($db_result === false) {
            return new WP_REST_Response(['message' => 'خطا در ذخیره پیام: ' . $wpdb->last_error], 500);
        }
        $msg_id = $wpdb->insert_id;

        // بروزرسانی timestamp مکالمه و last_read فرستنده
        $wpdb->update($t_conv,    ['updated_at'   => gmdate('Y-m-d H:i:s')], ['id' => $conv_id]);
        $wpdb->update($t_members, ['last_read_at' => gmdate('Y-m-d H:i:s')],
            ['conversation_id' => $conv_id, 'user_id' => $uid]);

        $sender = get_userdata($uid);

        // ساخت replyTo payload
        $reply_to_data = null;
        if (!empty($params['replyToId'])) {
            $reply = $wpdb->get_row($wpdb->prepare(
                "SELECT id, message_type, content, sender_id FROM $t_msgs WHERE id = %d",
                (int) $params['replyToId']
            ));
            if ($reply) {
                $reply_sender  = get_userdata((int) $reply->sender_id);
                $reply_to_data = [
                    'id'         => (int) $reply->id,
                    'type'       => $reply->message_type,
                    'content'    => $reply->content,
                    'senderId'   => (int) $reply->sender_id,
                    'senderName' => $reply_sender ? $reply_sender->display_name : 'ناشناس',
                ];
            }
        }

        // Payload پایه پیام — status=sent (تیک اول)
        $base_message = [
            'id'               => $msg_id,
            'type'             => $msg_type,
            'content'          => $content,
            'translatedContent'=> null,
            'senderLang'       => $sender_lang,
            'translatedVoice'  => !empty($params['translatedVoice']),
            'originalText'     => isset($params['originalText'])     ? $params['originalText']     : null,
            'originalAudioUrl' => isset($params['originalAudioUrl']) ? $params['originalAudioUrl'] : null,
            'mediaUrl'         => isset($params['mediaUrl'])         ? $params['mediaUrl']         : null,
            'duration'         => isset($params['duration'])         ? (int) $params['duration']   : 0,
            'senderId'         => $uid,
            'senderName'       => $sender ? $sender->display_name : 'ناشناس',
            'isEdited'         => false,
            'createdAt'        => gmdate('Y-m-d H:i:s'),
            'conversationId'   => $conv_id,
            'replyTo'          => $reply_to_data,
            'status'           => 'sent',   // ← تیک اول
        ];

        // ارسال event تیک اول به همه اعضا
        $this->trigger_pusher_event('team-conversation-' . $conv_id, 'new-message', $base_message);

        // ── STEP 2: ترجمه → تیک دوم ──────────────────────────────────────
        $translated_content = null;
        $needs_translation  = ($sender_lang !== 'fa' && !empty($content) && $msg_type === 'text');

        if ($needs_translation) {
            $translated_content = $this->do_translate($content, 'fa');

            // ذخیره ترجمه در DB
            if ($translated_content) {
                $wpdb->update($t_msgs,
                    ['translated_content' => $translated_content],
                    ['id' => $msg_id]
                );
            }
        }

        // Payload کامل پیام با ترجمه — status=translated (تیک دوم)
        $full_message = array_merge($base_message, [
            'translatedContent' => $translated_content,
            'status'            => 'translated',  // ← تیک دوم
        ]);

        // ارسال event تیک دوم به channel مکالمه (همه اعضا می‌بینن)
        $this->trigger_pusher_event(
            'team-conversation-' . $conv_id,
            'message-translated',
            $full_message
        );

        // ارسال event به channel شخصی فرستنده
        // → پیام در چت خود فرستنده هم فوری آپدیت می‌شه (بدون reload)
        $this->trigger_pusher_event(
            'team-user-' . $uid,
            'message-translated',
            $full_message
        );

        // اطلاع‌رسانی به بقیه اعضا + push notification
        $members     = $wpdb->get_col($wpdb->prepare(
            "SELECT user_id FROM $t_members WHERE conversation_id = %d AND user_id != %d",
            $conv_id, $uid
        ));
        $push        = new AsadMindset_Push_Notifications();
        $sender_name = $sender ? $sender->display_name : 'تیم';
        $msg_body    = $msg_type === 'text'
            ? mb_substr($content, 0, 100)
            : ($msg_type === 'image' ? '📷 تصویر' : ($msg_type === 'video' ? '🎬 ویدیو' : '🎤 صوتی'));

        foreach ($members as $member_id) {
            $this->trigger_pusher_event('team-user-' . $member_id, 'new-team-message', [
                'conversationId' => $conv_id,
                'message'        => $full_message,
            ]);
            $push->send_to_user(
                (int) $member_id,
                '💬 ' . $sender_name,
                $msg_body,
                ['type' => 'team', 'conversationId' => (string) $conv_id, 'url' => '/?open=teamChat&chatId=' . $conv_id]
            );
        }

        return new WP_REST_Response(['success' => true, 'message' => $full_message], 200);
    }
    
    public function edit_message($r) {
        global $wpdb;
        $uid    = $this->get_user_id_from_request($r);
        $msg_id = (int) $r->get_param('id');
        $params = $r->get_json_params();
        
        $t_msgs = $wpdb->prefix . 'team_messages';
        
        $msg = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $t_msgs WHERE id = %d AND sender_id = %d", $msg_id, $uid
        ));
        
        if (!$msg) {
            return new WP_REST_Response(['message' => 'پیام یافت نشد'], 404);
        }
        
        $wpdb->update($t_msgs, [
            'content'   => $params['content'],
            'is_edited' => 1,
        ], ['id' => $msg_id]);
        
        $this->trigger_pusher_event('team-conversation-' . $msg->conversation_id, 'message-edited', [
            'id'       => $msg_id,
            'content'  => $params['content'],
            'isEdited' => true,
        ]);
        
        return new WP_REST_Response(['success' => true], 200);
    }
    
    public function delete_message($r) {
        global $wpdb;
        $uid    = $this->get_user_id_from_request($r);
        $msg_id = (int) $r->get_param('id');
        
        $t_msgs = $wpdb->prefix . 'team_messages';
        
        $msg = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $t_msgs WHERE id = %d AND sender_id = %d", $msg_id, $uid
        ));
        
        if (!$msg) {
            return new WP_REST_Response(['message' => 'پیام یافت نشد'], 404);
        }
        
        $wpdb->delete($t_msgs, ['id' => $msg_id]);
        
        $this->trigger_pusher_event('team-conversation-' . $msg->conversation_id, 'message-deleted', [
            'id' => $msg_id,
        ]);
        
        return new WP_REST_Response(['success' => true], 200);
    }
    
    public function mark_as_read($r) {
        global $wpdb;
        $uid     = $this->get_user_id_from_request($r);
        $conv_id = (int) $r->get_param('id');
        
        $t_members = $wpdb->prefix . 'team_conversation_members';
        
        $wpdb->update($t_members,
            ['last_read_at' => gmdate('Y-m-d H:i:s')],
            ['conversation_id' => $conv_id, 'user_id' => $uid]
        );
        
        $this->trigger_pusher_event('team-conversation-' . $conv_id, 'messages-read', [
            'userId' => $uid,
            'readAt' => gmdate('Y-m-d H:i:s'),
        ]);
        
        return new WP_REST_Response(['success' => true], 200);
    }
    
    public function typing_indicator($r) {
        $uid     = $this->get_user_id_from_request($r);
        $conv_id = (int) $r->get_param('id');
        $params  = $r->get_json_params();
        
        $sender = get_userdata($uid);
        
        $this->trigger_pusher_event('team-conversation-' . $conv_id, 'typing', [
            'userId'      => $uid,
            'userName'    => $sender ? $sender->display_name : 'ناشناس',
            'isTyping'    => isset($params['isTyping'])    ? (bool) $params['isTyping']    : true,
            'isRecording' => isset($params['isRecording']) ? (bool) $params['isRecording'] : false,
        ]);
        
        return new WP_REST_Response(['success' => true], 200);
    }
    
    public function get_team_members($r) {
        global $wpdb;
        
        $result = [];
        
        $admins = get_users(['role' => 'administrator']);
        foreach ($admins as $admin) {
            if (user_can($admin, 'manage_options')) {
                $result[] = [
                    'userId'      => (int) $admin->ID,
                    'displayName' => $admin->display_name,
                    'email'       => $admin->user_email,
                    'role'        => 'ادمین اصلی',
                    'isMainAdmin' => true,
                ];
            }
        }
        
        $table      = $wpdb->prefix . 'sub_admins';
        $sub_admins = $wpdb->get_results(
            "SELECT user_id, label, permissions FROM $table WHERE is_active = 1"
        );
        
        $existing_ids = array_column($result, 'userId');
        
        foreach ($sub_admins as $sa) {
            if (in_array((int) $sa->user_id, $existing_ids)) continue;
            
            $u = get_userdata((int) $sa->user_id);
            if (!$u) continue;
            
            $result[] = [
                'userId'      => (int) $sa->user_id,
                'displayName' => $u->display_name,
                'email'       => $u->user_email,
                'role'        => $sa->label ?: 'کاربر ارشد',
                'isMainAdmin' => false,
            ];
        }
        
        return new WP_REST_Response($result, 200);
    }
    
    public function update_conversation($r) {
        global $wpdb;
        $uid     = $this->get_user_id_from_request($r);
        $conv_id = (int) $r->get_param('id');
        $params  = $r->get_json_params();
        
        $t_conv = $wpdb->prefix . 'team_conversations';
        
        $conv = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t_conv WHERE id = %d", $conv_id));
        if (!$conv || $conv->type !== 'group') {
            return new WP_REST_Response(['message' => 'گروه یافت نشد'], 404);
        }
        
        if (!$this->is_conversation_admin($conv_id, $uid)) {
            $user = get_user_by('id', $uid);
            if (!$user || !user_can($user, 'manage_options')) {
                return new WP_REST_Response(['message' => 'فقط ادمین گروه می‌تواند تغییر دهد'], 403);
            }
        }
        
        $update = [];
        if (isset($params['name']))      $update['name']       = sanitize_text_field($params['name']);
        if (isset($params['avatarUrl'])) $update['avatar_url'] = $params['avatarUrl'];
        
        if (!empty($update)) {
            $wpdb->update($t_conv, $update, ['id' => $conv_id]);
            $this->trigger_pusher_event('team-conversation-' . $conv_id, 'conversation-updated', $update);
        }
        
        return new WP_REST_Response(['success' => true], 200);
    }
    
    public function add_member($r) {
        global $wpdb;
        $uid     = $this->get_user_id_from_request($r);
        $conv_id = (int) $r->get_param('id');
        $params  = $r->get_json_params();
        
        $t_conv    = $wpdb->prefix . 'team_conversations';
        $t_members = $wpdb->prefix . 'team_conversation_members';
        
        $conv = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t_conv WHERE id = %d AND type = 'group'", $conv_id));
        if (!$conv) {
            return new WP_REST_Response(['message' => 'گروه یافت نشد'], 404);
        }
        
        if (!$this->is_conversation_member($conv_id, $uid)) {
            return new WP_REST_Response(['message' => 'دسترسی ندارید'], 403);
        }
        
        $new_user_id = isset($params['userId']) ? (int) $params['userId'] : 0;
        if (!$new_user_id) {
            return new WP_REST_Response(['message' => 'کاربر مشخص نشده'], 400);
        }
        
        if ($this->is_conversation_member($conv_id, $new_user_id)) {
            return new WP_REST_Response(['message' => 'این کاربر قبلاً عضو است'], 400);
        }
        
        $wpdb->insert($t_members, [
            'conversation_id' => $conv_id,
            'user_id'         => $new_user_id,
            'role'            => 'member',
            'joined_at'       => gmdate('Y-m-d H:i:s'),
        ]);
        
        $new_user = get_userdata($new_user_id);
        $adder    = get_userdata($uid);
        
        $this->trigger_pusher_event('team-conversation-' . $conv_id, 'member-added', [
            'userId'      => $new_user_id,
            'displayName' => $new_user ? $new_user->display_name : 'ناشناس',
            'addedBy'     => $adder ? $adder->display_name : 'ناشناس',
        ]);
        
        $this->trigger_pusher_event('team-user-' . $new_user_id, 'new-conversation', [
            'conversationId' => $conv_id,
            'type'           => 'group',
            'name'           => $conv->name,
        ]);
        
        return new WP_REST_Response(['success' => true], 200);
    }
    
    public function remove_member($r) {
        global $wpdb;
        $uid            = $this->get_user_id_from_request($r);
        $conv_id        = (int) $r->get_param('id');
        $target_user_id = (int) $r->get_param('user_id');
        
        $t_conv    = $wpdb->prefix . 'team_conversations';
        $t_members = $wpdb->prefix . 'team_conversation_members';
        
        $conv = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t_conv WHERE id = %d AND type = 'group'", $conv_id));
        if (!$conv) {
            return new WP_REST_Response(['message' => 'گروه یافت نشد'], 404);
        }
        
        if (!$this->is_conversation_admin($conv_id, $uid)) {
            $user = get_user_by('id', $uid);
            if (!$user || !user_can($user, 'manage_options')) {
                return new WP_REST_Response(['message' => 'فقط ادمین گروه می‌تواند عضو حذف کند'], 403);
            }
        }
        
        $wpdb->delete($t_members, [
            'conversation_id' => $conv_id,
            'user_id'         => $target_user_id,
        ]);
        
        $removed_user = get_userdata($target_user_id);
        
        $this->trigger_pusher_event('team-conversation-' . $conv_id, 'member-removed', [
            'userId'      => $target_user_id,
            'displayName' => $removed_user ? $removed_user->display_name : 'ناشناس',
        ]);
        
        return new WP_REST_Response(['success' => true], 200);
    }
    
    public function leave_conversation($r) {
        global $wpdb;
        $uid     = $this->get_user_id_from_request($r);
        $conv_id = (int) $r->get_param('id');
        
        $t_conv    = $wpdb->prefix . 'team_conversations';
        $t_members = $wpdb->prefix . 'team_conversation_members';
        
        $conv = $wpdb->get_row($wpdb->prepare("SELECT * FROM $t_conv WHERE id = %d AND type = 'group'", $conv_id));
        if (!$conv) {
            return new WP_REST_Response(['message' => 'گروه یافت نشد'], 404);
        }
        
        $wpdb->delete($t_members, [
            'conversation_id' => $conv_id,
            'user_id'         => $uid,
        ]);
        
        $user = get_userdata($uid);
        
        $this->trigger_pusher_event('team-conversation-' . $conv_id, 'member-left', [
            'userId'      => $uid,
            'displayName' => $user ? $user->display_name : 'ناشناس',
        ]);
        
        return new WP_REST_Response(['success' => true], 200);
    }

    public function save_translation($request) {
        global $wpdb;
        $msg_id     = (int) $request->get_param('id');
        $params     = $request->get_json_params();
        $translated = $params['translatedContent'] ?? '';
        
        if (empty($translated)) {
            return new WP_REST_Response(['error' => 'No translation'], 400);
        }
        
        $t_msgs = $wpdb->prefix . 'team_messages';
        $wpdb->update($t_msgs,
            ['translated_content' => $translated],
            ['id' => $msg_id]
        );
        
        return new WP_REST_Response(['success' => true], 200);
    }

    private function do_translate($text, $target_lang) {
        $lang_names = [
            'fa' => 'Persian (Farsi)', 'de' => 'German', 'fr' => 'French',
            'en' => 'English',         'es' => 'Spanish',
        ];
        $lang_name = $lang_names[$target_lang] ?? 'Persian (Farsi)';
        $api_key   = get_option('asadmindset_chatgpt_api_key', '');
        if (empty($api_key)) return null;
        
        $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'timeout' => 15,
            'headers' => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $api_key,
            ],
            'body' => json_encode([
                'model'    => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'system', 'content' => "You are a translator. Translate the following text to {$lang_name}. If the text is already in {$lang_name}, return it unchanged. Return ONLY the translated text, nothing else. No quotes, no explanation, no notes."],
                    ['role' => 'user',   'content' => $text],
                ],
                'max_tokens'  => 1000,
                'temperature' => 0.1,
            ]),
        ]);
        
        if (is_wp_error($response)) return null;
        $body       = json_decode(wp_remote_retrieve_body($response), true);
        $translated = $body['choices'][0]['message']['content'] ?? null;
        return $translated ? trim($translated) : null;
    }

    public function translate_message($request) {
        $params      = $request->get_json_params();
        $text        = $params['text']       ?? '';
        $target_lang = $params['targetLang'] ?? 'fa';
        
        if (empty($text)) {
            return new WP_REST_Response(['error' => 'No text provided'], 400);
        }
        
        $api_key = get_option('asadmindset_chatgpt_api_key', '');
        if (empty($api_key)) {
            return new WP_REST_Response(['error' => 'API key not configured'], 500);
        }
        
        $translated = $this->do_translate($text, $target_lang);
        
        if (!$translated) {
            return new WP_REST_Response(['error' => 'Translation failed'], 500);
        }
        
        return new WP_REST_Response(['success' => true, 'translated' => $translated], 200);
    }

    public function set_user_lang($r) {
        $uid    = $this->get_user_id_from_request($r);
        $params = $r->get_json_params();
        $lang   = sanitize_text_field($params['lang'] ?? 'fa');
        $allowed = ['fa', 'de', 'en', 'fr', 'es'];
        
        if (!in_array($lang, $allowed)) {
            return new WP_REST_Response(['error' => 'Invalid lang'], 400);
        }
        
        update_user_meta($uid, 'teamchat_lang', $lang);
        
        global $wpdb;
        $t_members = $wpdb->prefix . 'team_conversation_members';
        $conv_ids  = $wpdb->get_col($wpdb->prepare(
            "SELECT conversation_id FROM $t_members WHERE user_id = %d", $uid
        ));
        foreach ($conv_ids as $cid) {
            $this->trigger_pusher_event(
                'team-conversation-' . $cid,
                'member-lang-changed',
                ['userId' => $uid, 'lang' => $lang]
            );
        }
        
        return new WP_REST_Response(['success' => true, 'lang' => $lang], 200);
    }

    public function speech_to_text($r) {
        $api_key = get_option('asadmindset_chatgpt_api_key', '');
        if (empty($api_key)) {
            return new WP_REST_Response(['error' => 'API key not configured'], 500);
        }

        $files = $r->get_file_params();
        if (empty($files['file'])) {
            return new WP_REST_Response(['error' => 'No audio file provided'], 400);
        }

        $file         = $files['file'];
        $source_lang  = sanitize_text_field($r->get_param('sourceLang') ?? 'fa');
        $lang_map     = ['fa' => 'fa', 'de' => 'de', 'en' => 'en', 'fr' => 'fr', 'es' => 'es'];
        $whisper_lang = $lang_map[$source_lang] ?? 'fa';

        $tmp_path  = $file['tmp_name'];
        $orig_name = $file['name'] ?? 'voice.webm';

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => 'https://api.openai.com/v1/audio/transcriptions',
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $api_key],
            CURLOPT_POSTFIELDS     => [
                'file'            => new CURLFile($tmp_path, $file['type'] ?? 'audio/webm', $orig_name),
                'model'           => 'whisper-1',
                'language'        => $whisper_lang,
                'response_format' => 'json',
            ],
        ]);

        $response  = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code !== 200) {
            $err = json_decode($response, true);
            return new WP_REST_Response(['error' => $err['error']['message'] ?? 'Whisper failed'], 500);
        }

        $data = json_decode($response, true);
        $text = trim($data['text'] ?? '');

        if (empty($text)) {
            return new WP_REST_Response(['error' => 'Empty transcription'], 500);
        }

        return new WP_REST_Response(['success' => true, 'text' => $text], 200);
    }

    /**
     * POST /voice/tts — Text to Speech via OpenAI TTS
     *
     * قبل از ساخت صدا، متن ترجمه شده از API چک می‌شه.
     * اگه مشکل داشت (بیش از حد کوتاه، حاوی کد خطا، یا ناقص)
     * یک بار دیگه ترجمه می‌شه و بعد صدا ساخته می‌شه.
     */
    public function text_to_speech($r) {
        $api_key = get_option('asadmindset_chatgpt_api_key', '');
        if (empty($api_key)) {
            return new WP_REST_Response(['error' => 'API key not configured'], 500);
        }

        $params      = $r->get_json_params();
        $text        = sanitize_text_field($params['text']       ?? '');
        $target_lang = sanitize_text_field($params['targetLang'] ?? 'fa');
        $orig_text   = sanitize_text_field($params['originalText'] ?? ''); // متن اصلی قبل از ترجمه

        if (empty($text)) {
            return new WP_REST_Response(['error' => 'No text provided'], 400);
        }

        // ── Validation: بررسی کیفیت ترجمه ─────────────────────────────
        // اگه متن اصلی داریم، کیفیت ترجمه رو چک می‌کنیم
        $validated_text = $text;
        if (!empty($orig_text) && $orig_text !== $text) {
            $is_bad = $this->is_bad_translation($text, $orig_text, $target_lang);
            if ($is_bad) {
                // ترجمه مجدد با دستور دقیق‌تر
                $retried = $this->do_translate_strict($orig_text, $target_lang);
                if ($retried) {
                    $validated_text = $retried;
                }
            }
        }

        $voice_map = ['fa' => 'nova', 'de' => 'onyx', 'en' => 'alloy', 'fr' => 'shimmer', 'es' => 'echo'];
        $voice     = $voice_map[$target_lang] ?? 'nova';

        $response = wp_remote_post('https://api.openai.com/v1/audio/speech', [
            'timeout' => 30,
            'headers' => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $api_key,
            ],
            'body' => json_encode([
                'model'           => 'tts-1',
                'input'           => $validated_text,
                'voice'           => $voice,
                'response_format' => 'mp3',
            ]),
        ]);

        if (is_wp_error($response)) {
            return new WP_REST_Response(['error' => 'TTS request failed'], 500);
        }

        $http_code = wp_remote_retrieve_response_code($response);
        if ($http_code !== 200) {
            return new WP_REST_Response(['error' => 'TTS API error: ' . $http_code], 500);
        }

        $upload_dir = wp_upload_dir();
        $filename   = 'tts_' . uniqid() . '.mp3';
        $filepath   = $upload_dir['path'] . '/' . $filename;
        $fileurl    = $upload_dir['url']  . '/' . $filename;

        file_put_contents($filepath, wp_remote_retrieve_body($response));

        return new WP_REST_Response([
            'success'       => true,
            'url'           => $fileurl,
            'validatedText' => $validated_text,  // برگشت متن validate شده به frontend
        ], 200);
    }

    /**
     * بررسی اینکه ترجمه مشکل داره یا نه
     */
    private function is_bad_translation($translated, $original, $target_lang) {
        // ۱. خیلی کوتاه‌تر از اصل (کمتر از ۳۰٪ طول)
        $orig_len  = mb_strlen(trim($original));
        $trans_len = mb_strlen(trim($translated));
        if ($orig_len > 10 && $trans_len < ($orig_len * 0.3)) {
            return true;
        }

        // ۲. همان متن اصلی برگشته (ترجمه نشده)
        if (trim($translated) === trim($original)) {
            return true;
        }

        // ۳. حاوی پیام‌های خطای رایج OpenAI
        $error_patterns = ['I cannot', 'I\'m sorry', 'As an AI', 'I apologize', 'نمی‌توانم', 'متأسفم'];
        foreach ($error_patterns as $pattern) {
            if (stripos($translated, $pattern) !== false) {
                return true;
            }
        }

        // ۴. فارسی فرستاده برای فارسی (نباید ترجمه بشه)
        if ($target_lang === 'fa') {
            // اگه متن ترجمه شده حاوی کاراکتر لاتین زیادی باشه مشکوکه
            preg_match_all('/[a-zA-Z]/', $translated, $latin);
            $latin_ratio = count($latin[0]) / max(1, $trans_len);
            if ($latin_ratio > 0.5) {
                return true;
            }
        }

        return false;
    }

    /**
     * ترجمه با دستور دقیق‌تر برای retry
     */
    private function do_translate_strict($text, $target_lang) {
        $lang_names = [
            'fa' => 'Persian (Farsi)', 'de' => 'German', 'fr' => 'French',
            'en' => 'English',         'es' => 'Spanish',
        ];
        $lang_name = $lang_names[$target_lang] ?? 'Persian (Farsi)';
        $api_key   = get_option('asadmindset_chatgpt_api_key', '');
        if (empty($api_key)) return null;

        $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'timeout' => 20,
            'headers' => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $api_key,
            ],
            'body' => json_encode([
                'model' => 'gpt-4o-mini',
                'messages' => [
                    [
                        'role'    => 'system',
                        'content' => "You are a professional translator. Your ONLY job is to translate text. "
                            . "Translate the user's message to {$lang_name}. "
                            . "Output ONLY the translated text. "
                            . "Do NOT include any explanation, notes, quotes, or apologies. "
                            . "Do NOT refuse. Just translate.",
                    ],
                    ['role' => 'user', 'content' => $text],
                ],
                'max_tokens'  => 1500,
                'temperature' => 0.05,
            ]),
        ]);

        if (is_wp_error($response)) return null;
        $body       = json_decode(wp_remote_retrieve_body($response), true);
        $translated = $body['choices'][0]['message']['content'] ?? null;
        return $translated ? trim($translated) : null;
    }
}

// Initialize
AsadMindset_TeamChat::get_instance();