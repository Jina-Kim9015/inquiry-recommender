// ===== DOM =====
const userInput       = document.getElementById('userInput');
const recordInput     = document.getElementById('recordInput');
const charCount       = document.getElementById('charCount');
const submitBtn       = document.getElementById('submitBtn');
const clearBtn        = document.getElementById('clearBtn');
const resultSection   = document.getElementById('resultSection');
const loadingIndicator= document.getElementById('loadingIndicator');
const resultText      = document.getElementById('resultText');
const copyBtn         = document.getElementById('copyBtn');
const newBtn          = document.getElementById('newBtn');
const toast           = document.getElementById('toast');
const examplesList    = document.getElementById('examplesList');
const recordToggleBtn = document.getElementById('recordToggleBtn');
const recordBody      = document.getElementById('recordBody');
const designSection   = document.getElementById('designSection');
const designBtn       = document.getElementById('designBtn');
const designTopicInput= document.getElementById('designTopicInput');
const designResult    = document.getElementById('designResult');
const designLoading   = document.getElementById('designLoading');
const designText      = document.getElementById('designText');

// ===== 상태 =====
let isStreaming     = false;
let isDesigning     = false;
let rawMarkdown     = '';
let designMarkdown  = '';
let selectedTrack   = '';

// ===== 초기화 =====
window.addEventListener('DOMContentLoaded', () => {
    loadExamples();
    userInput.addEventListener('input', updateCharCount);
    setupTrackButtons();
    setupRecordToggle();
});

// ===== 계열 버튼 =====
function setupTrackButtons() {
    document.querySelectorAll('.track-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTrack = btn.dataset.track;
        });
    });
    // 기본 선택: 전체
    document.querySelector('.track-btn[data-track=""]').classList.add('active');
}

// ===== 생기부 토글 =====
function setupRecordToggle() {
    recordToggleBtn.addEventListener('click', () => {
        const isOpen = recordBody.style.display !== 'none';
        recordBody.style.display = isOpen ? 'none' : 'block';
        recordToggleBtn.textContent = isOpen ? '펼치기 ▼' : '접기 ▲';
    });
}

// ===== 예시 =====
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

// ===== 초기화 =====
clearBtn.addEventListener('click', () => {
    userInput.value = '';
    recordInput.value = '';
    updateCharCount();
    userInput.focus();
});

// ===== 새로 추천 =====
newBtn.addEventListener('click', () => {
    resultSection.style.display = 'none';
    designSection.style.display = 'none';
    userInput.value = '';
    recordInput.value = '';
    updateCharCount();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== 복사 =====
copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(rawMarkdown); }
    catch {
        const el = document.createElement('textarea');
        el.value = rawMarkdown;
        document.body.appendChild(el); el.select();
        document.execCommand('copy'); document.body.removeChild(el);
    }
    showToast('클립보드에 복사되었습니다!');
});

// ===== 추천 요청 =====
submitBtn.addEventListener('click', () => { if (!isStreaming) submitRequest(); });
userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isStreaming) submitRequest();
});

async function submitRequest() {
    const input = userInput.value.trim();
    if (!input) { showToast('주제나 기사 내용을 입력해주세요.', 'error'); userInput.focus(); return; }

    isStreaming = true;
    rawMarkdown = '';

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = '분석 중...';
    resultSection.style.display = 'block';
    designSection.style.display = 'none';
    loadingIndicator.style.display = 'flex';
    resultText.innerHTML = '';
    resultText.style.display = 'none';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await fetch('/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input,
                track: selectedTrack,
                record: recordInput.value.trim()
            })
        });

        if (!res.ok) { const e = await res.json(); throw new Error(e.error || '서버 오류'); }

        loadingIndicator.style.display = 'none';
        resultText.style.display = 'block';
        await streamToElement(res, rawMarkdown, resultText, (md) => { rawMarkdown = md; });

        // 탐구 과정 설계 섹션 표시
        designSection.style.display = 'block';
        designSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
        loadingIndicator.style.display = 'none';
        resultText.style.display = 'block';
        resultText.innerHTML = errorHtml(err.message);
        showToast(err.message, 'error');
    } finally {
        isStreaming = false;
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = '탐구 주제 추천받기';
    }
}

// ===== 탐구 과정 설계 =====
designBtn.addEventListener('click', () => { if (!isDesigning) designRequest(); });
designTopicInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !isDesigning) designRequest();
});

async function designRequest() {
    const topic = designTopicInput.value.trim();
    if (!topic) { showToast('탐구 주제를 입력해주세요.', 'error'); designTopicInput.focus(); return; }

    isDesigning = true;
    designMarkdown = '';

    designBtn.disabled = true;
    designBtn.querySelector('.btn-text').textContent = '설계 중...';
    designResult.style.display = 'block';
    designLoading.style.display = 'flex';
    designText.innerHTML = '';
    designText.style.display = 'none';
    designResult.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await fetch('/design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, track: selectedTrack })
        });

        if (!res.ok) { const e = await res.json(); throw new Error(e.error || '서버 오류'); }

        designLoading.style.display = 'none';
        designText.style.display = 'block';
        await streamToElement(res, designMarkdown, designText, (md) => { designMarkdown = md; });

    } catch (err) {
        designLoading.style.display = 'none';
        designText.style.display = 'block';
        designText.innerHTML = errorHtml(err.message);
        showToast(err.message, 'error');
    } finally {
        isDesigning = false;
        designBtn.disabled = false;
        designBtn.querySelector('.btn-text').textContent = '설계하기';
    }
}

// ===== 공통 스트리밍 처리 =====
async function streamToElement(response, md, el, setMd) {
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
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
                const parsed = JSON.parse(data);
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.text) {
                    md += parsed.text;
                    setMd(md);
                    el.innerHTML = renderMarkdown(md);
                }
            } catch (e) {
                if (e.message !== 'Unexpected end of JSON input') throw e;
            }
        }
    }
    el.innerHTML = renderMarkdown(md);
}

// ===== 마크다운 렌더러 =====
function renderMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
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

function escapeHtml(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function errorHtml(msg) {
    return `<div style="color:#EF4444;padding:20px;text-align:center;">
        <p style="font-size:32px;margin-bottom:12px;">⚠️</p>
        <p style="font-weight:600;margin-bottom:8px;">오류가 발생했습니다</p>
        <p style="font-size:14px;color:#6B7280;">${escapeHtml(msg)}</p>
        <p style="font-size:13px;color:#9CA3AF;margin-top:12px;">잠시 후 다시 시도해보세요.</p>
    </div>`;
}

// ===== 토스트 =====
let toastTimer = null;
function showToast(msg, type = 'success') {
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#EF4444' : '#1F2937';
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}
