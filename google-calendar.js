
/* Google Calendar 연결 기능
   기존 app.js와 Supabase 설정은 수정하지 않습니다.
*/

// Google Cloud에서 발급받은 값으로 바꿔 주세요.
const GOOGLE_CLIENT_ID = "309562030182-jit2t0v0ae7kiugr9mganp5v5glh2eek.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyA3EF3XnFFEBiNmp5DU5WLwribC-7Guytw";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events"
].join(" ");

const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

const $ = (id) => document.getElementById(id);

let tokenClient = null;
let googleReady = false;
let calendarEvents = [];

function calendarMessage(text, error = false) {
  const el = $("google-calendar-message");
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? "#b15f50" : "";
}

function loadGoogleScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("구글 라이브러리를 불러오지 못했어요."));
    document.head.appendChild(script);
  });
}

async function initializeGoogleCalendar() {
  try {
    if (
      GOOGLE_CLIENT_ID.startsWith("여기에_") ||
      GOOGLE_API_KEY.startsWith("여기에_")
    ) {
      calendarMessage(
        "먼저 google-calendar.js에 OAuth 클라이언트 ID와 API 키를 입력해 주세요.",
        true
      );
      return;
    }

    await Promise.all([
      loadGoogleScript("https://apis.google.com/js/api.js"),
      loadGoogleScript("https://accounts.google.com/gsi/client")
    ]);

    await new Promise((resolve) => gapi.load("client", resolve));

    await gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: [DISCOVERY_DOC]
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: async (response) => {
        if (response.error) {
          calendarMessage("구글 계정 연결에 실패했어요.", true);
          return;
        }

        gapi.client.setToken({
          access_token: response.access_token
        });

        $("google-connect-btn").textContent = "구글 계정 연결됨";
        $("google-calendar-controls").classList.remove("hidden");

        await loadCalendars();
      }
    });

    googleReady = true;
  } catch (error) {
    console.error(error);
    calendarMessage(
      "구글 캘린더 초기화에 실패했어요. 설정과 API 사용 여부를 확인해 주세요.",
      true
    );
  }
}

async function connectGoogleCalendar() {
  if (!googleReady || !tokenClient) {
    calendarMessage("구글 캘린더를 준비 중이에요. 잠시 후 다시 눌러 주세요.");
    return;
  }

  calendarMessage("구글 계정 연결을 진행하고 있어요.");

  tokenClient.requestAccessToken({ prompt: "consent" });
}

async function loadCalendars() {
  try {
    calendarMessage("접근 가능한 캘린더를 불러오는 중이에요.");

    const response = await gapi.client.calendar.calendarList.list({
      maxResults: 250
    });

    const select = $("google-calendar-select");
    select.replaceChildren();

    const calendars = response.result.items || [];

    if (!calendars.length) {
      calendarMessage("접근 가능한 캘린더가 없어요.", true);
      return;
    }

    calendars.forEach((calendar) => {
      const option = document.createElement("option");
      option.value = calendar.id;
      option.textContent =
        calendar.summary + (calendar.primary ? " (내 기본 캘린더)" : "");
      select.appendChild(option);
    });

    calendarMessage("캘린더를 연결했어요.");
    await loadEvents();
  } catch (error) {
    console.error(error);
    calendarMessage(
      "캘린더 목록을 불러오지 못했어요. 공유 권한과 구글 계정을 확인해 주세요.",
      true
    );
  }
}

async function loadEvents() {
  const calendarId = $("google-calendar-select").value;
  if (!calendarId) return;

  try {
    calendarMessage("일정을 불러오는 중이에요.");

    const response = await gapi.client.calendar.events.list({
      calendarId,
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false
    });

    calendarEvents = response.result.items || [];
    renderEvents();

    calendarMessage(
      calendarEvents.length
        ? `${calendarEvents.length}개의 예정된 일정을 불러왔어요.`
        : "예정된 일정이 없어요."
    );
  } catch (error) {
    console.error(error);
    calendarMessage(
      "일정을 불러오지 못했어요. 이 캘린더의 접근 권한을 확인해 주세요.",
      true
    );
  }
}

function formatEventDate(event) {
  const value = event.start?.dateTime || event.start?.date;
  if (!value) return "날짜 미정";

  if (event.start?.date && !event.start?.dateTime) {
    return `${event.start.date} · 종일`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderEvents() {
  const container = $("google-calendar-events");
  container.replaceChildren();

  if (!calendarEvents.length) {
    const empty = document.createElement("p");
    empty.className = "calendar-hint";
    empty.textContent = "표시할 예정 일정이 없어요.";
    container.appendChild(empty);
    return;
  }

  calendarEvents.forEach((event) => {
    const card = document.createElement("article");
    card.className = "calendar-event-card";

    const title = document.createElement("strong");
    title.textContent = event.summary || "(제목 없는 일정)";

    const date = document.createElement("p");
    date.textContent = formatEventDate(event);

    card.append(title, date);

    if (event.htmlLink) {
      const link = document.createElement("a");
      link.href = event.htmlLink;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "구글 캘린더에서 보기";
      card.appendChild(link);
    }

    const actions = document.createElement("div");
    actions.className = "calendar-event-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button-light";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => editEvent(event));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button button-light";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => deleteEvent(event));

    actions.append(editButton, deleteButton);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function localDateTimeInput(value) {
  const date = value ? new Date(value) : new Date();
  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return adjusted.toISOString().slice(0, 16);
}

async function addEvent() {
  const calendarId = $("google-calendar-select").value;
  if (!calendarId) {
    calendarMessage("먼저 캘린더를 선택해 주세요.", true);
    return;
  }

  const summary = prompt("일정 제목을 입력해 주세요.");
  if (!summary?.trim()) return;

  const startDefault = new Date(Date.now() + 60 * 60 * 1000);
  const endDefault = new Date(startDefault.getTime() + 60 * 60 * 1000);

  const startInput = prompt(
    "시작 날짜와 시간 (예: 2026-10-30T14:00)",
    localDateTimeInput(startDefault)
  );
  if (!startInput) return;

  const endInput = prompt(
    "종료 날짜와 시간",
    localDateTimeInput(endDefault)
  );
  if (!endInput) return;

  const startDate = new Date(startInput);
  const endDate = new Date(endInput);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    calendarMessage("날짜와 시간을 올바르게 입력해 주세요.", true);
    return;
  }

  try {
    await gapi.client.calendar.events.insert({
      calendarId,
      resource: {
        summary: summary.trim(),
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() }
      }
    });

    calendarMessage("새 일정을 등록했어요.");
    await loadEvents();
  } catch (error) {
    console.error(error);
    calendarMessage("일정을 등록하지 못했어요. 편집 권한을 확인해 주세요.", true);
  }
}

async function editEvent(event) {
  const calendarId = $("google-calendar-select").value;
  const summary = prompt(
    "일정 제목을 수정해 주세요.",
    event.summary || ""
  );

  if (summary === null || !summary.trim()) return;

  const resource = {
    summary: summary.trim(),
    start: event.start,
    end: event.end
  };

  // 종일 일정은 날짜와 시간을 유지하고 제목만 수정합니다.
  if (event.description) resource.description = event.description;
  if (event.location) resource.location = event.location;

  if (event.start?.dateTime) {
    const startInput = prompt(
      "시작 날짜와 시간",
      localDateTimeInput(event.start.dateTime)
    );
    if (!startInput) return;

    const endInput = prompt(
      "종료 날짜와 시간",
      localDateTimeInput(event.end.dateTime)
    );
    if (!endInput) return;

    const startDate = new Date(startInput);
    const endDate = new Date(endInput);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      calendarMessage("날짜와 시간을 올바르게 입력해 주세요.", true);
      return;
    }

    resource.start = { dateTime: startDate.toISOString() };
    resource.end = { dateTime: endDate.toISOString() };
  }

  try {
    await gapi.client.calendar.events.update({
      calendarId,
      eventId: event.id,
      resource
    });

    calendarMessage("일정을 수정했어요.");
    await loadEvents();
  } catch (error) {
    console.error(error);
    calendarMessage("일정을 수정하지 못했어요. 편집 권한을 확인해 주세요.", true);
  }
}

async function deleteEvent(event) {
  if (!confirm(`'${event.summary || "제목 없는 일정"}'을(를) 삭제할까요?`)) {
    return;
  }

  try {
    await gapi.client.calendar.events.delete({
      calendarId: $("google-calendar-select").value,
      eventId: event.id
    });

    calendarMessage("일정을 삭제했어요.");
    await loadEvents();
  } catch (error) {
    console.error(error);
    calendarMessage("일정을 삭제하지 못했어요. 편집 권한을 확인해 주세요.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("google-connect-btn")?.addEventListener("click", connectGoogleCalendar);
  $("google-refresh-btn")?.addEventListener("click", loadEvents);
  $("google-add-event-btn")?.addEventListener("click", addEvent);
  $("google-calendar-select")?.addEventListener("change", loadEvents);

  initializeGoogleCalendar();
});
