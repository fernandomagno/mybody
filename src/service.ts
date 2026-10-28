import { validateExam } from "./domain";
import type { Exam } from "./domain";

export type User = { id: string; email: string };
export type UserSession = { user: User };
export type AuthResult = UserSession & { recoveryCode?: string };
export const authTabId = crypto.randomUUID();

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      "Servidor local indisponivel. Inicie o sistema com npm run dev.",
    );
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("linha-session-expired"));
    throw new Error(
      data?.error ??
        "Nao foi possivel acessar o servidor local. Verifique se a API esta em execucao.",
    );
  }
  return data as T;
}

function notifyAuthChanged() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("linha-auth");
  channel.postMessage({ source: authTabId });
  channel.close();
}

export async function getSession(): Promise<UserSession | null> {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error(
      "Servidor local indisponivel. Inicie o sistema com npm run dev.",
    );
  return response.json();
}

export async function signIn(email: string, password: string) {
  const result = await request<AuthResult>("/auth/login", "POST", {
    email,
    password,
  });
  notifyAuthChanged();
  return result;
}

export async function signUp(
  email: string,
  password: string,
  consent: boolean,
) {
  const result = await request<AuthResult>("/auth/register", "POST", {
    email,
    password,
    consent,
  });
  notifyAuthChanged();
  return result;
}

export async function recoverPassword(
  email: string,
  recoveryCode: string,
  password: string,
) {
  const result = await request<AuthResult>("/auth/recover", "POST", {
    email,
    recoveryCode,
    password,
  });
  notifyAuthChanged();
  return result;
}

export async function signOut() {
  await request<void>("/auth/logout", "POST");
  notifyAuthChanged();
}

export async function fetchExams(): Promise<Exam[]> {
  const data = await request<{ exams: unknown[] }>("/exams");
  return data.exams.map(validateExam);
}

export async function saveExam(exam: Exam) {
  await request("/exams", "POST", validateExam(exam));
}

export async function deleteExam(id: string) {
  await request<void>(`/exams/${encodeURIComponent(id)}`, "DELETE");
}
