<?php
/**
 * AsadMindset AI Chat Proxy
 * پروکسی برای ارسال درخواست به Kimi API از طریق سرور
 * شامل endpoint عادی و streaming (SSE)
 */

if (!defined('ABSPATH')) {
    require_once dirname(dirname(dirname(dirname(__DIR__)))) . '/wp-load.php';
}

define('KIMI_API_KEY', 'sk-kqA33mybXQNMKR0Yz2Xp2TOkZMTchYW8P5OPlESe7WWKSnrU');
define('KIMI_API_URL', 'https://api.moonshot.ai/v1/chat/completions');

class AsadMindset_AI {

    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes() {
        $namespace = 'asadmindset/v1';
        $support = AsadMindset_Support::get_instance();

        // AI Chat - non-streaming (fallback)
        register_rest_route($namespace, '/ai/chat', array(
            'methods' => 'POST',
            'callback' => array($this, 'ai_chat'),
            'permission_callback' => array($support, 'check_user_auth')
        ));

        // AI Chat - streaming (SSE)
        register_rest_route($namespace, '/ai/chat-stream', array(
            'methods' => 'POST',
            'callback' => array($this, 'ai_chat_stream'),
            'permission_callback' => array($support, 'check_user_auth')
        ));

        // AI test
        register_rest_route($namespace, '/ai/test', array(
            'methods' => 'GET',
            'callback' => array($this, 'ai_test'),
            'permission_callback' => '__return_true'
        ));
    }

    /**
     * GET /ai/test
     */
    public function ai_test($request) {
        $body = array(
            'model' => 'kimi-k2.5',
            'messages' => array(array('role' => 'user', 'content' => 'سلام، فقط بگو سلام و بس.')),
            'stream' => false,
            'temperature' => 1.0,
            'top_p' => 0.95,
            'max_tokens' => 50,
        );

        $response = wp_remote_post(KIMI_API_URL, array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . KIMI_API_KEY,
            ),
            'body' => json_encode($body),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            return new WP_REST_Response(array('ok' => false, 'error' => $response->get_error_message()), 500);
        }

        $code = wp_remote_retrieve_response_code($response);
        $resp_body = json_decode(wp_remote_retrieve_body($response), true);
        return new WP_REST_Response(array('ok' => $code === 200, 'http_code' => $code, 'response' => $resp_body), 200);
    }

    /**
     * POST /ai/chat - Non-streaming
     */
    public function ai_chat($request) {
        $messages = $request->get_param('messages');
        if (empty($messages) || !is_array($messages)) {
            return new WP_REST_Response(array('error' => 'پیام‌ها خالی است'), 400);
        }
        if (count($messages) > 30) $messages = array_slice($messages, -30);

        $body = array(
            'model' => 'kimi-k2.5',
            'messages' => $messages,
            'stream' => false,
            'temperature' => 1.0,
            'top_p' => 0.95,
            'max_tokens' => 4096,
        );

        $response = wp_remote_post(KIMI_API_URL, array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . KIMI_API_KEY,
            ),
            'body' => json_encode($body),
            'timeout' => 120,
        ));

        if (is_wp_error($response)) {
            return new WP_REST_Response(array('error' => $response->get_error_message()), 500);
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($code !== 200) {
            return new WP_REST_Response(array('error' => $body['error']['message'] ?? 'خطا'), $code);
        }

        return new WP_REST_Response(array(
            'content' => $body['choices'][0]['message']['content'] ?? '',
            'usage' => $body['usage'] ?? null,
        ), 200);
    }

    /**
     * POST /ai/chat-stream - SSE Streaming
     */
    public function ai_chat_stream($request) {
        $messages = $request->get_param('messages');
        if (empty($messages) || !is_array($messages)) {
            return new WP_REST_Response(array('error' => 'پیام‌ها خالی است'), 400);
        }
        if (count($messages) > 30) $messages = array_slice($messages, -30);

        $body = json_encode(array(
            'model' => 'kimi-k2.5',
            'messages' => $messages,
            'stream' => true,
            'temperature' => 1.0,
            'top_p' => 0.95,
            'max_tokens' => 4096,
        ));

        // Clear all output buffers
        while (ob_get_level()) ob_end_clean();

        // SSE headers
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');

        // Stream via PHP curl
        $ch = curl_init();
        curl_setopt_array($ch, array(
            CURLOPT_URL => KIMI_API_URL,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => array(
                'Content-Type: application/json',
                'Authorization: Bearer ' . KIMI_API_KEY,
            ),
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_WRITEFUNCTION => function($ch, $data) {
                echo $data;
                if (ob_get_level()) ob_flush();
                flush();
                return strlen($data);
            },
        ));

        curl_exec($ch);

        if (curl_errno($ch)) {
            echo "data: " . json_encode(array('error' => curl_error($ch))) . "\n\n";
            flush();
        }

        curl_close($ch);
        exit;
    }
}

new AsadMindset_AI();