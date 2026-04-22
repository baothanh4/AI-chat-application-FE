/**
 * OpenRouter API Service
 * Gọi trực tiếp OpenRouter API từ trình duyệt với hỗ trợ streaming.
 */

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Model mặc định — hoạt động tốt, KHÔNG cần cấu hình privacy
const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

// Headers chung cho tất cả request
const getHeaders = () => ({
  'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': window.location.origin,
  'X-Title': 'ChatApplication AI Assistant',
});

// Parse thông điệp lỗi sang tiếng Việt dễ hiểu
function parseError(data) {
  const msg = data?.error?.message || data?.message || '';
  if (msg.includes('guardrail') || msg.includes('data policy') || msg.includes('No endpoints')) {
    return (
      'Model này yêu cầu bật Data Policy trên OpenRouter.\n\n' +
      '👉 Truy cập: https://openrouter.ai/settings/privacy\n' +
      '   → Bật "Allow providers to train on my data"\n\n' +
      '💡 Hoặc chọn model khác (Llama 3.1, Mistral) trong danh sách — các model đó không yêu cầu.'
    );
  }
  if (msg.includes('rate limit') || msg.includes('429') || data?.error?.code === 429) {
    return 'Đã vượt quá giới hạn tốc độ. Vui lòng thử lại sau vài giây.';
  }
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Invalid API key')) {
    return 'API key không hợp lệ. Hãy kiểm tra lại VITE_OPENROUTER_API_KEY trong file .env.';
  }
  if (msg.includes('insufficient_quota') || msg.includes('credits')) {
    return 'Tài khoản OpenRouter không đủ credit. Nạp thêm tại https://openrouter.ai/credits';
  }
  return msg || 'Lỗi không xác định từ OpenRouter.';
}

/**
 * Gửi tin nhắn tới OpenRouter và nhận phản hồi (không streaming)
 * @param {Array}  messages - Mảng { role, content }
 * @param {string} model    - Model ID
 * @returns {Promise<string>}
 */
export async function sendMessage(messages, model = DEFAULT_MODEL) {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ model, messages }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(parseError(data));
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Gửi tin nhắn tới OpenRouter với streaming (Server-Sent Events)
 * @param {Array}    messages - Mảng { role, content }
 * @param {Function} onChunk  - Callback nhận từng đoạn text
 * @param {Function} onDone   - Callback khi hoàn tất
 * @param {Function} onError  - Callback khi có lỗi
 * @param {string}   model    - Model ID
 * @returns {AbortController} - Để huỷ stream
 */
export async function sendMessageStream(messages, onChunk, onDone, onError, model = DEFAULT_MODEL) {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ model, messages, stream: true }),
        signal: controller.signal,
      });

      // Đọc body để lấy thông điệp lỗi trước khi throw
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(parseError(data));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Giữ lại dòng chưa hoàn chỉnh

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            // Lỗi trong stream chunk
            if (json.error) throw new Error(parseError(json));
            const content = json.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch (parseErr) {
            // Chỉ re-throw nếu là lỗi thực sự (không phải JSON syntax error)
            if (parseErr.message && !parseErr.message.startsWith('Unexpected') && !parseErr.message.startsWith('JSON')) {
              throw parseErr;
            }
          }
        }
      }

      onDone?.();
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err);
      }
    }
  })();

  return controller;
}

/**
 * Danh sách model — các model có dấu * cần bật Privacy settings trên OpenRouter.
 * Các model không có dấu * hoạt động bình thường.
 */
export const AVAILABLE_MODELS = [
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B ✓',
    provider: 'Meta',
    recommended: true,
    free: true,
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B ✓',
    provider: 'Meta',
    free: true,
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B ✓',
    provider: 'Mistral',
    free: true,
  },
  {
    id: 'microsoft/phi-3-mini-128k-instruct:free',
    name: 'Phi-3 Mini 128K ✓',
    provider: 'Microsoft',
    free: true,
  },
  {
    id: 'qwen/qwen-2.5-7b-instruct:free',
    name: 'Qwen 2.5 7B ✓',
    provider: 'Alibaba',
    free: true,
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B *',
    provider: 'Google',
    free: true,
    note: 'Cần Privacy settings',
  },
  {
    id: 'meta-llama/llama-4-scout:free',
    name: 'Llama 4 Scout *',
    provider: 'Meta',
    free: true,
    note: 'Cần Privacy settings',
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 *',
    provider: 'DeepSeek',
    free: true,
    note: 'Cần Privacy settings',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    free: false,
  },
];
