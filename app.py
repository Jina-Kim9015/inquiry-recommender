import os
import json
import re
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from groq import Groq

app = Flask(__name__)

# 한국어/영문/숫자/기본 기호 외의 문자를 제거하는 필터
def filter_korean(text):
    return re.sub(
        r'[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F'
        r'A-Za-z0-9 \t\n\r'
        r'\.\,\!\?\:\;\-\(\)\[\]\{\}\/\\\'\"\`'
        r'\#\*\_\~\>\<\+\=\@\&\%\^\$'
        r'\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF'
        r']', '', text)

RECOMMEND_PROMPT = """[중요] 모든 답변은 반드시 한국어(Korean)로만 작성하세요. 영어, 중국어, 일본어, 러시아어, 베트남어, 한자 등 한국어가 아닌 문자는 단 하나도 사용하지 마세요.

당신은 대한민국 고등학교 교육과정 전문가이자 진로 탐구 지도 선생님입니다.
학생이 관심 주제나 기사 내용을 입력하면, 2015 개정 교육과정의 고등학교 교과목과 연결하여 실제로 수행할 수 있는 탐구 주제를 추천해야 합니다.
2015 개정 교육과정의 주요 고등학교 교과는 다음과 같습니다:
- 국어 교과: 국어, 문학, 독서, 화법과 작문, 언어와 매체
- 수학 교과: 수학, 수학I, 수학II, 미적분, 확률과 통계, 기하
- 영어 교과: 영어, 영어I, 영어II, 영어 독해와 작문
- 사회(역사/도덕 포함): 통합사회, 한국사, 사회문화, 생활과 윤리, 윤리와 사상, 한국지리, 세계지리, 동아시아사, 세계사, 경제, 정치와 법
- 과학 교과: 통합과학, 과학탐구실험, 물리학I·II, 화학I·II, 생명과학I·II, 지구과학I·II
- 기술·가정/정보: 기술·가정, 정보
- 체육·예술: 체육, 운동과 건강, 음악, 미술
- 제2외국어, 한문, 교양 등

다음 형식으로 답변하세요:

## 📌 입력 내용 분석
(입력된 내용의 핵심 키워드와 주제를 2-3문장으로 요약. 계열 정보나 생활기록부 활동이 있으면 어떻게 반영했는지도 언급)

## 🔍 탐구 주제 추천

각 탐구 주제에 대해 다음 형식으로 작성:

### [번호]. [탐구 주제 제목]
- **관련 교과**: [교과명] - [단원/주제]
- **탐구 유형**: [실험 탐구 / 문헌 조사 / 설문 조사 / 데이터 분석 / 비교 분석 등]
- **탐구 내용**: (탐구에서 다룰 내용을 2-3문장으로 설명)
- **가능한 탐구 방법**: (구체적인 수행 방법 2-3가지를 간략히 제시)
- **기대 효과**: (이 탐구를 통해 얻을 수 있는 학문적/진로적 이점)

최소 4개, 최대 6개의 탐구 주제를 추천하세요.
계열 정보가 있으면 그 계열에 적합한 주제를 중심으로 추천하되, 다양한 교과와도 연결하세요.
생활기록부 활동이 있으면 그 활동과 자연스럽게 연결되는 탐구 주제를 우선적으로 추천하세요.
고등학생이 실제로 수행 가능한 현실적인 주제를 제시하세요.

마지막에 다음을 추가하세요:

## 💡 추가 팁
(이 주제로 탐구를 진행할 때 유용한 팁이나 참고할 자료 유형 2-3가지)"""

DESIGN_PROMPT = """[중요] 모든 답변은 반드시 한국어(Korean)로만 작성하세요. 한자, 중국어, 일본어, 러시아어 등을 절대 사용하지 마세요.

당신은 대한민국 고등학교 탐구 활동 전문 지도 교사입니다.
학생이 선택한 탐구 주제에 대해 실제로 수행 가능한 상세한 탐구 계획을 설계해주세요.

다음 형식으로 답변하세요:

## 🗺️ 탐구 과정 설계

### 1단계. 탐구 주제 및 목적
- **최종 탐구 주제**: (구체적이고 명확하게 다듬은 주제)
- **탐구 목적**: (이 탐구를 통해 알고자 하는 것)
- **탐구 가설**: (예상되는 결과 또는 검증하고자 하는 명제)

### 2단계. 탐구 방법 설계
- **탐구 유형**: (실험/설문/문헌/데이터 분석 등)
- **구체적 방법**: (단계별 수행 방법 상세히)
- **필요한 도구/자료**: (실험 도구, 설문지, 데이터 출처 등)

### 3단계. 탐구 일정 (총 4주 기준)
- **1주차**:
- **2주차**:
- **3주차**:
- **4주차**:

### 4단계. 예상 결과 및 한계
- **예상 결과**:
- **예상되는 한계점**:
- **한계 극복 방안**:

### 5단계. 교과 연계 및 진로 연결
- **연계 교과 단원**:
- **진로 연결점**: (이 탐구가 어떤 진로/학과 선택에 도움이 되는지)

## 📝 생활기록부 기재 예시
(이 탐구 활동을 생활기록부 세부능력 및 특기사항에 기재할 때 활용할 수 있는 예시 문구 2-3줄)"""


def stream_response(system_prompt, user_message):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        yield f"data: {json.dumps({'error': '서버 설정 오류: API 키가 없습니다.'})}\n\n"
        yield "data: [DONE]\n\n"
        return
    try:
        client = Groq(api_key=api_key)
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message}
            ],
            stream=True,
            max_tokens=4000,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                clean = filter_korean(delta.content)
                if clean:
                    yield f"data: {json.dumps({'text': clean})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    yield "data: [DONE]\n\n"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    user_input = data.get("input", "").strip()
    track      = data.get("track", "").strip()       # 계열
    record     = data.get("record", "").strip()      # 생활기록부 활동

    if not user_input:
        return jsonify({"error": "입력 내용이 없습니다."}), 400
    if len(user_input) > 5000:
        return jsonify({"error": "입력 내용이 너무 깁니다. 5000자 이내로 입력해주세요."}), 400

    # 사용자 메시지 구성
    parts = ["[한국어로만 답변]\n\n다음 내용을 분석하고 탐구 주제를 추천해주세요."]
    if track:
        parts.append(f"\n\n**학생 계열**: {track}")
    if record:
        parts.append(f"\n\n**생활기록부 주요 활동**:\n{record}")
    parts.append(f"\n\n**관심 주제 / 기사 내용**:\n{user_input}")
    user_message = "".join(parts)

    return Response(
        stream_with_context(stream_response(RECOMMEND_PROMPT, user_message)),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.route("/design", methods=["POST"])
def design():
    data = request.get_json()
    topic  = data.get("topic", "").strip()
    track  = data.get("track", "").strip()

    if not topic:
        return jsonify({"error": "탐구 주제를 입력해주세요."}), 400

    parts = ["[한국어로만 답변]\n\n다음 탐구 주제에 대해 상세한 탐구 과정을 설계해주세요."]
    if track:
        parts.append(f"\n\n**학생 계열**: {track}")
    parts.append(f"\n\n**탐구 주제**: {topic}")
    user_message = "".join(parts)

    return Response(
        stream_with_context(stream_response(DESIGN_PROMPT, user_message)),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.route("/examples", methods=["GET"])
def examples():
    return jsonify([
        {
            "title": "기후변화와 탄소중립",
            "content": "최근 전 세계적으로 기후변화로 인한 이상기후 현상이 증가하고 있습니다. 우리나라도 폭염, 집중호우 등의 빈도가 높아지고 있으며, 정부는 2050 탄소중립을 목표로 다양한 정책을 추진하고 있습니다."
        },
        {
            "title": "인공지능과 일상생활",
            "content": "ChatGPT, 생성형 AI 등 인공지능 기술이 빠르게 발전하면서 우리의 일상과 직업 세계에 큰 변화를 가져오고 있습니다. AI가 창작 활동, 의료 진단, 교육 분야에도 활용되고 있습니다."
        },
        {
            "title": "청소년 정신건강",
            "content": "코로나19 이후 청소년들의 우울감과 불안감이 증가하고 있다는 연구 결과가 발표되었습니다. SNS 사용 증가와 사회적 고립이 주요 원인으로 지목되고 있으며, 학교 상담 수요도 늘어나고 있습니다."
        },
        {
            "title": "플라스틱 오염과 재활용",
            "content": "해양 플라스틱 쓰레기 문제가 심각해지면서 미세플라스틱이 먹이사슬을 통해 인체에 축적된다는 연구들이 발표되고 있습니다. 재활용률을 높이고 플라스틱 사용을 줄이기 위한 다양한 방법이 논의되고 있습니다."
        }
    ])


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
