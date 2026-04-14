// ===== DOM 요소 =====
const userInput = document.getElementById('userInput');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const resultSection = document.getElementById('resultSection');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultText = document.getElementById('resultText');
const copyBtn = document.getElementById('copyBtn');
const newBtn = document.getElementById('newBtn');
const toast = document.getElementById('toast');
const examplesList = document.getElementById('examplesList');
const modelSelect = document.getElementById('modelSelect');

// ===== 상태 =====
let isStreaming = false;
let rawMarkdown = '';

// ===== 초기화 =====
window.addEventListener('DOMContentLoaded', () => {
    loadExamples();
    userInput.addEventListener('input', updateCharCount);
});

// ===== 예시 로드 =====
async function loadExamples() {
    try {
        const res = await fetch('/examples');
        const examples = await res.json();
        examplesList.innerHTML = '';
        examples.forEach(ex => {
            const btn = document.createElement('button');
            btn.className = 'example-btn';
            btn.textContent = ex.title;
            btn.addEventListener('click', () => {
                userInput.value = ex.content;
                updateCharCount();
                userInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            examplesList.appendChild(btn);
        });
    } catch {
        examplesList.innerHTML = '<span style="font-size:13px;color:#9CA3AF;">예시를 불러올 수 없습니다.</span>';
    }
}

// ===== 글자 수 =====
function updateCharCount() {
    const len = userInput.value.length;
    charCount.textContent = `${len.toLocaleString()} / 5,000`;
    charCount.style.color = len > 4500 ? '#EF4444' : len > 4000 ? '#F59E0B' : '#9CA3AF';
}

// ===== 초기화 버튼 =====
clearBtn.addEventListener('click', () => {
    userInput.value = '';
    updateCharCount();
    userInput.focus();
});

// ===== 새로 추천받기 =====
newBtn.addEventListener('click', () => {
    resultSection.style.display = 'none';
    userInput.value = '';
    updateCharCount();
    userInput.focus();
    userInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ===== 복사 =====
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(rawMarkdown);
        showToast('클립보드에 복사되었습니다!');
    } catch {
        const el = document.createElement('textarea');
        el.value = rawMarkdown;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('클립보드에 복사되었습니다!');
    }
});

// ===== 제출 =====
submitBtn.addEventListener('click', () => { if (!isStreaming) submitRequest(); });
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isStreaming) submitRequest();
});

async function submitRequest() {
    const input = userInput.value.trim();
    if (!input) {
        showToast('주제나 기사 내용을 입력해주세요.', 'error');
        userInput.focus();
        return;
    }

    isStreaming = true;
    rawMarkdown = '';

    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    const modelId = modelSelect.value;
    const providerName = selectedOption.dataset.provider;

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = '분석 중...';
    resultSection.style.display = 'block';
    loadingIndicator.style.display = 'flex';
    resultText.innerHTML = '';
    resultText.style.display = 'none';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const response = await fetch('/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input, model: modelId, provider: providerName })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || '서버 오류가 발생했습니다.');
        }

        loadingIndicator.style.display = 'none';
        resultText.style.display = 'block';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) throw new Error(parsed.error);
                        if (parsed.text) {
                            rawMarkdown += parsed.text;
                            resultText.innerHTML = renderMarkdown(rawMarkdown);
                        }
                    } catch (parseErr) {
                        if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr;
                    }
                }
            }
        }

        resultText.innerHTML = renderMarkdown(rawMarkdown);

    } catch (err) {
        loadingIndicator.style.display = 'none';
        resultText.style.display = 'block';
        resultText.innerHTML = `<div style="color:#EF4444;padding:20px;text-align:center;">
            <p style="font-size:32px;margin-bottom:12px;">⚠️</p>
            <p style="font-weight:600;margin-bottom:8px;">오류가 발생했습니다</p>
            <p style="font-size:14px;color:#6B7280;">${escapeHtml(err.message)}</p>
            <p style="font-size:13px;color:#9CA3AF;margin-top:12px;">잠시 후 다시 시도하거나 다른 모델을 선택해보세요.</p>
        </div>`;
        showToast(err.message, 'error');
    } finally {
        isStreaming = false;
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = '탐구 주제 추천받기';
    }
}

// ===== 마크다운 렌더러 =====
function renderMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<h[23]>)/g, '$1');
    html = html.replace(/(<\/h[23]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    return html;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ===== 토스트 =====
let toastTimer = null;
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#EF4444' : '#1F2937';
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}
