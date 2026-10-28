import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FilePlus2,
  FileText,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  comparePoints,
  groupIndicators,
  numberFromInput,
  validateExam,
} from "./domain";
import type { Exam, Indicator } from "./domain";
import {
  deleteExam,
  fetchExams,
  saveExam,
  getSession,
  signIn,
  signUp,
  signOut,
  recoverPassword,
  authTabId,
} from "./service";
import type { AuthResult, UserSession } from "./service";
import { demoExams } from "./demo";
import { readPdf } from "./pdf";
import "./App.css";

const formatNumber = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Ocorreu um erro. Tente novamente.";
// Build publico estatico: sem API nem banco, somente a demonstracao.
const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === "true";

function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <HeartPulse size={23} />
      </span>
      <span>
        My <span className="brand-dot">Body</span>
        <small>MEUS EXAMES</small>
      </span>
    </div>
  );
}

function Auth({
  onDemo,
  onAuthenticated,
  initialMessage,
}: {
  onDemo: () => void;
  onAuthenticated: (session: UserSession) => void;
  initialMessage: string;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [pending, setPending] = useState<AuthResult | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result =
        mode === "login"
          ? await signIn(email, password)
          : mode === "signup"
            ? await signUp(email, password, consent)
            : await recoverPassword(email, recoveryCode.trim(), password);
      setPassword("");
      setRecoveryCode("");
      if (result.recoveryCode) {
        setCodeSaved(false);
        setPending(result);
      } else onAuthenticated(result);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (DEMO_ONLY)
    return (
      <div className="auth-page">
        <header className="auth-header">
          <Brand />
          <span>
            <LockKeyhole size={15} /> Demonstracao publica
          </span>
        </header>
        <main className="auth-main">
          <div className="auth-heading">
            <span className="eyebrow">VERSAO DE DEMONSTRACAO</span>
            <h1>Conheca o My Body.</h1>
            <p>Explore o painel com dados ficticios.</p>
          </div>
          <div className="notice amber">
            <ShieldCheck size={19} />
            <p>
              <strong>Sem login e sem armazenamento</strong>Esta versao publica
              nao tem servidor nem banco de dados. Nao envie exames reais:
              nada e salvo e tudo some ao sair.
            </p>
          </div>
          <button className="button primary full" onClick={onDemo}>
            Abrir demonstracao <ArrowRight size={17} />
          </button>
        </main>
        <footer className="auth-footer">
          My Body <span>Acompanhamento pessoal. Nao substitui avaliacao medica.</span>
        </footer>
      </div>
    );
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Brand />
        <span>
          <LockKeyhole size={15} /> Acesso pessoal
        </span>
      </header>
      <main className="auth-main">
        <div className="auth-heading">
          <span className="eyebrow">SEU HISTORICO, EM PERSPECTIVA</span>
          <h1>
            {pending
              ? "Guarde seu acesso."
              : mode === "signup"
                ? "Comece seu historico."
                : mode === "forgot"
                  ? "Recupere seu acesso."
                  : "Bom ter voce aqui."}
          </h1>
          <p>
            {pending
              ? "Este codigo permite recuperar sua conta sem e-mail."
              : "Cada resultado faz parte da sua historia."}
          </p>
        </div>
        {pending ? (
          <section className="recovery-panel">
            <div className="notice amber">
              <ShieldCheck size={19} />
              <p>
                <strong>Codigo exibido uma unica vez</strong>Guarde em um
                gerenciador de senhas. Nao compartilhe. A recuperacao de senha
                invalida este codigo e gera um novo.
              </p>
            </div>
            <code className="recovery-code">{pending.recoveryCode}</code>
            <label className="check-label">
              <input
                type="checkbox"
                checked={codeSaved}
                onChange={(event) => setCodeSaved(event.target.checked)}
              />
              <span>Guardei meu codigo de recuperacao em um local seguro.</span>
            </label>
            <button
              className="button primary full"
              disabled={!codeSaved}
              onClick={() => onAuthenticated(pending)}
            >
              Continuar para meus exames <ArrowRight size={17} />
            </button>
          </section>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <div className="notice">
              <ShieldCheck size={19} />
              <p>
                <strong>Armazenamento local · SQLite</strong>Seus resultados
                ficam no computador que executa este servidor.
              </p>
            </div>
            {initialMessage && !message && (
              <p className="form-message" role="status">
                {initialMessage}
              </p>
            )}
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                required
                disabled={busy}
              />
            </label>
            {mode === "forgot" && (
              <label>
                Codigo de recuperacao
                <input
                  autoComplete="off"
                  required
                  minLength={40}
                  maxLength={100}
                  value={recoveryCode}
                  onChange={(event) => setRecoveryCode(event.target.value)}
                  disabled={busy}
                  placeholder="Codigo recebido ao criar sua conta"
                />
              </label>
            )}
            <label>
              {mode === "forgot" ? "Nova senha" : "Senha"}
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode !== "login" ? "Pelo menos 12 caracteres" : "Sua senha"
                }
                required
                disabled={busy}
              />
            </label>
            {mode === "signup" && (
              <label className="check-label">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  Autorizo salvar neste computador os resultados revisados da
                  minha conta. Poderei excluir meus exames. O e-mail e usado
                  apenas como identificador, sem envio de mensagens.
                </span>
              </label>
            )}
            <button className="button primary full" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={18} />}
              {mode === "login"
                ? "Entrar na minha conta"
                : mode === "signup"
                  ? "Criar conta"
                  : "Redefinir senha"}
              <ArrowRight size={17} />
            </button>
            {message && (
              <p className="form-message" role="status">
                {message}
              </p>
            )}
            <div className="auth-options">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setMessage("");
                }}
              >
                {mode === "signup" ? "Ja tenho uma conta" : "Criar uma conta"}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setMode(mode === "forgot" ? "login" : "forgot");
                  setMessage("");
                }}
              >
                {mode === "forgot" ? "Voltar ao login" : "Esqueci a senha"}
              </button>
            </div>
          </form>
        )}
        {!pending && (
          <button className="demo-link" onClick={onDemo}>
            Explorar demonstracao <ArrowRight size={16} />
          </button>
        )}
        <p className="auth-footnote">
          <ShieldCheck size={15} /> Seus resultados pertencem a voce.
        </p>
      </main>
      <footer className="auth-footer">
        My Body{" "}
        <span>Acompanhamento pessoal. Nao substitui avaliacao medica.</span>
      </footer>
    </div>
  );
}

type DraftReading = {
  id: string;
  name: string;
  value: string;
  kind: "numeric" | "text";
  unit: string;
  reference: string;
};
function ExamEditor({
  onClose,
  onSave,
  demo,
}: {
  onClose: () => void;
  onSave: (exam: Exam) => Promise<void>;
  demo: boolean;
}) {
  const [filename, setFilename] = useState("");
  const [date, setDate] = useState("");
  const [laboratory, setLaboratory] = useState("");
  const [rows, setRows] = useState<DraftReading[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [patientConfirmed, setPatientConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    setText("");
    setRows([]);
    setConfirmed(false);
    setPatientConfirmed(false);
    setFilename(file.name);
    try {
      const result = await readPdf(file);
      setText(result.text);
      setRows(
        result.readings.map((reading) => ({
          ...reading,
          value:
            typeof reading.value === "number"
              ? String(reading.value).replace(".", ",")
              : reading.value,
          kind: typeof reading.value === "number" ? "numeric" : "text",
        })),
      );
      setNotice(
        result.readings.length
          ? `${result.readings.length} itens sugeridos. Confira cada nome, valor, unidade e referencia com o PDF; a leitura pode omitir itens.`
          : "Nenhum item identificado com seguranca. O PDF pode ser escaneado ou ter outro formato. Adicione os itens manualmente a partir do original; esta versao nao inclui OCR.",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  function addRow() {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        name: "",
        value: "",
        kind: "numeric",
        unit: "",
        reference: "",
      },
    ]);
    setConfirmed(false);
  }
  function changeRow(id: string, field: keyof DraftReading, value: string) {
    setRows(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
    setConfirmed(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || !patientConfirmed) return;
    setError("");
    setBusy(true);
    try {
      const exam = validateExam({
        id: crypto.randomUUID(),
        date,
        laboratory,
        filename,
        readings: rows.map((row) => ({
          ...row,
          value:
            row.kind === "text" ? row.value.trim() : numberFromInput(row.value),
          unit:
            row.unit.trim() || (row.kind === "text" ? "qualitativo" : "indice"),
        })),
      });
      await onSave(exam);
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="exam-dialog"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
    >
      <div className="dialog-title">
        <div>
          <span className="eyebrow">NOVO REGISTRO</span>
          <h2>Adicionar exame</h2>
        </div>
        <button
          className="icon-button"
          title="Fechar"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="dialog-body">
          {demo && (
            <div className="notice amber">
              Demonstracao: qualquer resultado adicionado fica apenas nesta
              sessao. Nao envie exames reais.
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={busy}
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="upload-zone"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={27} />
            ) : (
              <Upload size={27} />
            )}
            <strong>
              {busy ? "Processando..." : filename || "Selecionar PDF"}
            </strong>
            <span>
              PDF ate 15 MB · Leitura local, sem guardar o arquivo original
            </span>
          </button>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <div className="form-grid">
            <label>
              Data da coleta
              <input
                type="date"
                required
                value={date}
                disabled={busy}
                onChange={(event) => {
                  setDate(event.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              Laboratorio
              <input
                value={laboratory}
                required
                maxLength={100}
                disabled={busy}
                onChange={(event) => setLaboratory(event.target.value)}
                placeholder="Nome do laboratorio"
              />
            </label>
          </div>
          <div className="review-heading">
            <h3>
              Resultados para revisao <span>{rows.length}</span>
            </h3>
            <button
              type="button"
              className="button small"
              onClick={addRow}
              disabled={busy || rows.length >= 300}
            >
              <Plus size={16} />
              Adicionar item
            </button>
          </div>
          <div className="review-rows">
            {rows.map((row, index) => (
              <fieldset className="review-row" key={row.id} disabled={busy}>
                <legend>Item {index + 1}</legend>
                <div className="reading-fields">
                  <label className="reading-name">
                    Indicador
                    <input
                      required
                      maxLength={100}
                      value={row.name}
                      onChange={(event) =>
                        changeRow(row.id, "name", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Formato
                    <select
                      aria-label={`Formato do item ${index + 1}`}
                      value={row.kind}
                      onChange={(event) =>
                        changeRow(row.id, "kind", event.target.value)
                      }
                    >
                      <option value="numeric">Numero exato</option>
                      <option value="text">Texto / limite</option>
                    </select>
                  </label>
                  <label>
                    Resultado
                    <input
                      required
                      inputMode={row.kind === "numeric" ? "decimal" : "text"}
                      maxLength={500}
                      value={row.value}
                      onChange={(event) =>
                        changeRow(row.id, "value", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Unidade
                    <input
                      required={row.kind === "numeric"}
                      maxLength={40}
                      placeholder="mg/dL"
                      value={row.unit}
                      onChange={(event) =>
                        changeRow(row.id, "unit", event.target.value)
                      }
                    />
                  </label>
                  <label className="reading-reference">
                    Referencia do laudo
                    <input
                      maxLength={200}
                      placeholder="Copie do exame"
                      value={row.reference}
                      onChange={(event) =>
                        changeRow(row.id, "reference", event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button danger"
                    title={`Remover item ${index + 1}`}
                    aria-label={`Remover item ${index + 1}`}
                    onClick={() => {
                      setRows(rows.filter((item) => item.id !== row.id));
                      setConfirmed(false);
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </fieldset>
            ))}
          </div>
          {!rows.length && (
            <p className="empty-inline">
              Selecione um PDF ou adicione os resultados manualmente.
            </p>
          )}
          {text && (
            <details className="extracted-text">
              <summary>Texto extraido do PDF</summary>
              <pre>{text}</pre>
            </details>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={patientConfirmed}
              onChange={(event) => setPatientConfirmed(event.target.checked)}
              required
              disabled={busy}
            />
            <span>
              Este exame pertence a mesma pessoa dos demais registros desta
              conta.
            </span>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              required
              disabled={busy}
            />
            <span>
              Conferi a data da coleta e todos os resultados com o laudo
              original e autorizo salva-los na minha conta.
            </span>
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy || !confirmed || !patientConfirmed || !rows.length}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}
            Confirmar resultados
          </button>
        </div>
      </form>
    </dialog>
  );
}

function IndicatorCard({
  indicator,
  selected,
  onSelect,
}: {
  indicator: Indicator;
  selected: boolean;
  onSelect: () => void;
}) {
  const latest = indicator.points.at(-1)!;
  const delta = comparePoints(indicator.points);
  return (
    <button
      className={`indicator-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="indicator-label">
        <span>{indicator.name}</span>
        <ChevronRight size={16} />
      </div>
      <div className="indicator-value">
        {formatNumber(latest.value)}
        <small>{indicator.unit}</small>
      </div>
      <div className="sparkline" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={indicator.points}>
            <Line
              type="linear"
              dataKey="value"
              dot={false}
              stroke={selected ? "#20856b" : "#93aaa0"}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <YAxis hide domain={["dataMin - 3", "dataMax + 3"]} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="indicator-bottom">
        <span className="delta">
          {delta ? (
            <>
              {delta.difference < 0 ? (
                <ArrowDown size={13} />
              ) : delta.difference > 0 ? (
                <ArrowUp size={13} />
              ) : null}
              {formatNumber(Math.abs(delta.difference))} {indicator.unit}
            </>
          ) : (
            "Sem comparativo"
          )}
        </span>
        <span>{formatDate(latest.date)}</span>
      </div>
    </button>
  );
}

function Dashboard({
  exams,
  demo,
  email,
  loading,
  message,
  onSave,
  onDelete,
  onLogout,
  onRetry,
}: {
  exams: Exam[];
  demo: boolean;
  email?: string;
  loading: boolean;
  message: string;
  onSave: (exam: Exam) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLogout: () => void;
  onRetry: () => void;
}) {
  const [view, setView] = useState<"overview" | "history" | "privacy">(
    "overview",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [editor, setEditor] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const allIndicators = groupIndicators(exams);
  const lastDate = [...exams].sort((left, right) =>
    right.date.localeCompare(left.date),
  )[0]?.date;
  const cutoff =
    dateFilter === "all" || !lastDate
      ? ""
      : (() => {
          const limit = new Date(`${lastDate}T12:00:00`);
          limit.setMonth(limit.getMonth() - Number(dateFilter));
          return `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}`;
        })();
  const indicators = groupIndicators(
    exams.filter((exam) => !cutoff || exam.date >= cutoff),
  ).filter((indicator) =>
    indicator.name
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const nonNumeric = exams
    .filter((exam) => !cutoff || exam.date >= cutoff)
    .flatMap((exam) =>
      exam.readings
        .filter(
          (reading) =>
            typeof reading.value === "string" &&
            reading.name
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
        )
        .map((reading) => ({
          ...reading,
          date: exam.date,
          examId: exam.id,
          laboratory: exam.laboratory,
        })),
    )
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        left.name.localeCompare(right.name),
    );
  const active =
    indicators.find((indicator) => indicator.key === selected) ?? indicators[0];
  const latest = active?.points.at(-1);
  const previous = active?.points.at(-2);
  const delta = active ? comparePoints(active.points) : null;
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, exams }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = demo
      ? "my-body-demonstracao.json"
      : "my-body-meus-resultados.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await onDelete(deleting);
      setDeleting(null);
    } catch (error) {
      setDeleteError(errorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">AREA PESSOAL</div>
        <nav aria-label="Principal">
          <button
            aria-label="Visao geral"
            title="Visao geral"
            className={view === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setView("overview")}
          >
            <LayoutDashboard size={19} />
            Visao geral
          </button>
          <button
            aria-label="Meus exames"
            title="Meus exames"
            className={view === "history" ? "nav-item active" : "nav-item"}
            onClick={() => setView("history")}
          >
            <ClipboardList size={19} />
            Meus exames<span className="nav-count">{exams.length}</span>
          </button>
          <button
            aria-label="Privacidade"
            title="Privacidade"
            className={view === "privacy" ? "nav-item active" : "nav-item"}
            onClick={() => setView("privacy")}
          >
            <ShieldCheck size={19} />
            Privacidade
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="care-note">
            <Activity size={21} />
            <strong>Um passo de cada vez.</strong>
            <p>Acompanhe sua historia com o apoio de um profissional.</p>
          </div>
          <button
            aria-label={demo ? "Sair da demonstracao" : "Sair da conta"}
            title="Sair"
            className="nav-item logout"
            onClick={onLogout}
          >
            <LogOut size={18} />
            {demo ? "Sair da demonstracao" : "Sair da conta"}
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Minha saude <ChevronRight size={13} />
            <strong>
              {view === "overview"
                ? "Visao geral"
                : view === "history"
                  ? "Meus exames"
                  : "Privacidade"}
            </strong>
          </div>
          <div className="user-area">
            <span className="connection">
              <span />
              {demo ? "Dados ficticios" : "Conta pessoal"}
            </span>
            <span className="avatar" title={email || "Demonstracao"}>
              {demo ? "DE" : email?.slice(0, 2).toUpperCase() || "EU"}
            </span>
          </div>
        </header>
        <main className="dashboard-main">
          {demo && (
            <div className="demo-banner">
              <FlaskConical size={16} />
              <span>
                Demonstracao com dados ficticios. Nao envie exames reais.
              </span>
              <button onClick={onLogout}>
                Ir para login <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">SEU HISTORICO DE SAUDE</div>
              <h1>
                {view === "overview"
                  ? "Cada resultado, uma perspectiva."
                  : view === "history"
                    ? "Meus exames"
                    : "Seus dados, suas escolhas."}
              </h1>
              <p>
                {view === "overview"
                  ? "Acompanhe seus indicadores ao longo do tempo."
                  : view === "history"
                    ? "Resultados revisados, organizados por data da coleta."
                    : "Transparencia sobre o seu historico pessoal."}
              </p>
            </div>
            <button
              className="button primary"
              disabled={loading || !!message}
              onClick={() => setEditor(true)}
            >
              <Plus size={18} />
              Adicionar exame
            </button>
          </div>
          {message && (
            <div className="notice amber" role="alert">
              <span>{message}</span>
              <button className="text-button" onClick={onRetry}>
                Tentar novamente
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={24} />
              Carregando seus exames...
            </div>
          ) : view === "privacy" ? (
            <section className="privacy-page">
              <ShieldCheck size={34} />
              <h2>Seu historico e pessoal.</h2>
              <dl>
                <dt>O que e armazenado</dt>
                <dd>
                  Apenas os resultados revisados, data da coleta, laboratorio e
                  nome do arquivo. O PDF original e o texto extraido nao sao
                  enviados ao banco.
                </dd>
                <dt>Quem pode acessar</dt>
                <dd>
                  A API local permite acesso apenas aos exames da conta
                  autenticada. Quem tem acesso ao arquivo SQLite no computador
                  tambem pode ler os dados; o banco nao tem criptografia
                  propria. Proteja o dispositivo e os backups.
                </dd>
                <dt>Sessao e dispositivo</dt>
                <dd>
                  A sessao usa um cookie protegido contra acesso por JavaScript,
                  com validade de ate 8 horas. Ao sair, ela e revogada no
                  servidor. O codigo de recuperacao substitui o envio de e-mail;
                  guarde-o em local seguro. Nao compartilhe a conta e use um
                  dispositivo confiavel.
                </dd>
                <dt>Exportar e excluir</dt>
                <dd>
                  Voce pode baixar seus resultados ou excluir cada exame na aba
                  Meus exames. A exclusao do cadastro e a retencao de backups
                  devem ser solicitadas ao operador do servico.
                </dd>
                <dt>Limite da interpretacao</dt>
                <dd>
                  Variacao nao significa melhora ou piora. Metodos
                  laboratoriais, jejum e referencias podem mudar. Indicadores
                  com unidades diferentes ficam separados. Resultados
                  qualitativos e valores como “menor que” ficam no historico,
                  sem calculo de variacao numerica. Confira-os no laudo
                  original.
                </dd>
              </dl>
              <button
                className="button"
                disabled={!exams.length}
                onClick={exportData}
              >
                <Download size={17} />
                Exportar meus resultados
              </button>
            </section>
          ) : !exams.length && !message ? (
            <section className="empty-state">
              <span className="empty-icon">
                <FilePlus2 size={35} />
              </span>
              <h2>Seu historico comeca no primeiro exame.</h2>
              <p>Adicione um PDF e revise os resultados antes de salvar.</p>
              <button
                className="button primary"
                onClick={() => setEditor(true)}
              >
                <Plus size={17} />
                Adicionar primeiro exame
              </button>
              <small>
                Use uma conta por pessoa para manter o comparativo correto.
              </small>
            </section>
          ) : view === "history" ? (
            <section className="history-section">
              <div className="section-heading">
                <h2>
                  Historico de exames <span>{exams.length}</span>
                </h2>
                <button className="button small" onClick={exportData}>
                  <Download size={16} />
                  Exportar
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Data da coleta</th>
                      <th>Laboratorio</th>
                      <th>Arquivo</th>
                      <th>Itens</th>
                      <th>
                        <span className="sr-only">Acoes</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...exams]
                      .sort((left, right) =>
                        right.date.localeCompare(left.date),
                      )
                      .map((exam) => (
                        <tr key={exam.id}>
                          <td>
                            <strong>{formatDate(exam.date)}</strong>
                          </td>
                          <td>{exam.laboratory}</td>
                          <td>
                            <span className="filename">
                              <FileText size={16} />
                              {exam.filename || "Inclusao manual"}
                            </span>
                          </td>
                          <td>{exam.readings.length}</td>
                          <td>
                            <button
                              className="icon-button danger"
                              title="Excluir exame"
                              aria-label={`Excluir exame de ${formatDate(exam.date)}`}
                              onClick={() => {
                                setDeleting(exam.id);
                                setDeleteError("");
                              }}
                            >
                              <Trash2 size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <>
              <section className="overview-layout">
              <aside className="indicators-section">
                <div className="section-heading">
                  <h2>
                    Seus indicadores <span>{indicators.length}</span>
                  </h2>
                  <div className="filters">
                    <label className="search-box">
                      <Search size={16} />
                      <input
                        placeholder="Buscar indicador"
                        aria-label="Buscar indicador"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <label className="period-filter">
                      <CalendarDays size={15} />
                      <select
                        aria-label="Periodo dos exames"
                        value={dateFilter}
                        onChange={(event) => setDateFilter(event.target.value)}
                      >
                        <option value="all">Todo o historico</option>
                        <option value="12">12 meses ate a ultima coleta</option>
                        <option value="6">6 meses ate a ultima coleta</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="indicator-grid">
                  {indicators.map((indicator) => (
                    <IndicatorCard
                      key={indicator.key}
                      indicator={indicator}
                      selected={active?.key === indicator.key}
                      onSelect={() => setSelected(indicator.key)}
                    />
                  ))}
                </div>
                {!indicators.length && (
                  <div className="empty-inline">
                    Nenhum indicador numerico exato encontrado para esta busca.
                  </div>
                )}
              </aside>
              {active && latest && (
                <div className="overview-main">
                  <div className="chart-section">
                    <div className="chart-heading">
                      <div>
                        <span className="eyebrow">EVOLUCAO DO INDICADOR</span>
                        <h2>{active.name}</h2>
                      </div>
                      <span className="unit-label">{active.unit}</span>
                    </div>
                    <div className="chart-legend">
                      <span />
                      Resultado por coleta{" "}
                      <small>{active.points.length} registros</small>
                    </div>
                    <div
                      className="main-chart"
                      role="img"
                      aria-label={`Evolucao de ${active.name}. Os valores tambem estao na tabela abaixo.`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={active.points}
                          margin={{ top: 16, right: 24, bottom: 8, left: 0 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            stroke="#e9eeeb"
                            strokeDasharray="4 5"
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value: string) =>
                              formatDate(value).slice(0, 5)
                            }
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: "#78817c" }}
                            minTickGap={20}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: "#78817c" }}
                            width={45}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            labelFormatter={(value) =>
                              formatDate(String(value))
                            }
                            formatter={(value) => [
                              `${formatNumber(Number(value))} ${active.unit}`,
                              "Resultado",
                            ]}
                            contentStyle={{
                              borderRadius: 6,
                              border: "1px solid #dfe6e2",
                              fontSize: 13,
                            }}
                          />
                          <Line
                            type="linear"
                            dataKey="value"
                            stroke="#20856b"
                            strokeWidth={3}
                            dot={{ r: 5, fill: "#fff", strokeWidth: 3 }}
                            activeDot={{ r: 7 }}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="chart-caption">
                      <CalendarDays size={14} />
                      Data da coleta{" "}
                      <span>
                        Unidades iguais. Confira metodos e referencias no laudo.
                      </span>
                    </div>
                  </div>
                  <aside className="comparison-panel">
                    <span className="eyebrow">ULTIMAS COLETAS</span>
                    <h3>Antes e depois</h3>
                    <div className="comparison-values">
                      <div>
                        <span>
                          Anterior
                          {previous && (
                            <small>{formatDate(previous.date)}</small>
                          )}
                        </span>
                        <strong>
                          {previous ? formatNumber(previous.value) : "-"}
                          <small>{active.unit}</small>
                        </strong>
                      </div>
                      <ArrowRight size={19} />
                      <div>
                        <span>
                          Atual<small>{formatDate(latest.date)}</small>
                        </span>
                        <strong>
                          {formatNumber(latest.value)}
                          <small>{active.unit}</small>
                        </strong>
                      </div>
                    </div>
                    <div className="variation">
                      <span>Variacao</span>
                      <strong>
                        {delta
                          ? `${delta.difference > 0 ? "+" : ""}${formatNumber(delta.difference)} ${active.unit}`
                          : "Sem comparativo"}
                      </strong>
                      <small>
                        {delta?.percent != null
                          ? `${delta.percent > 0 ? "+" : ""}${formatNumber(delta.percent)}% em relacao ao anterior`
                          : "Duas datas distintas sao necessarias."}
                      </small>
                    </div>
                    <div className="reference">
                      <span>Referencia do laudo atual</span>
                      <p>{latest.reference || "Nao informada"}</p>
                    </div>
                    <p className="medical-note">
                      <ShieldCheck size={16} />A variacao isolada nao indica
                      melhora ou piora. Converse com seu medico.
                    </p>
                  </aside>
                </div>
              )}
              </section>
              <section className="stats-strip" aria-label="Resumo do historico">
                <div>
                  <span className="stat-icon mint">
                    <FileText size={20} />
                  </span>
                  <div>
                    <span>Exames registrados</span>
                    <strong>
                      {exams.length.toString().padStart(2, "0")}
                      <small>no seu historico</small>
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="stat-icon peach">
                    <Activity size={20} />
                  </span>
                  <div>
                    <span>Indicadores acompanhados</span>
                    <strong>
                      {allIndicators.length.toString().padStart(2, "0")}
                      <small>resultados revisados</small>
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="stat-icon blue">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <span>Ultima coleta</span>
                    <strong className="date-stat">
                      {lastDate ? formatDate(lastDate) : "-"}
                      <small>data informada no exame</small>
                    </strong>
                  </div>
                </div>
              </section>
              {nonNumeric.length > 0 && (
                <section className="results-section qualitative-section">
                  <div className="section-heading">
                    <h2>
                      Resultados textuais e limites{" "}
                      <span>{nonNumeric.length}</span>
                    </h2>
                  </div>
                  <p className="qualitative-note">
                    Valores como inferior a, superior a e nao reagente sao
                    preservados sem transformar limites em medidas exatas.
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Indicador</th>
                          <th>Data da coleta</th>
                          <th>Resultado</th>
                          <th>Unidade</th>
                          <th>Referencia do laudo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nonNumeric.map((reading) => (
                          <tr key={`${reading.examId}-${reading.id}`}>
                            <td>{reading.name}</td>
                            <td>{formatDate(reading.date)}</td>
                            <td>
                              <strong>{reading.value}</strong>
                            </td>
                            <td>{reading.unit}</td>
                            <td>{reading.reference || "Nao informada"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {active && (
                <section className="results-section">
                  <div className="section-heading">
                    <h2>Registros de {active.name}</h2>
                    <button
                      className="text-button"
                      onClick={() => setView("history")}
                    >
                      Ver exames <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Data da coleta</th>
                          <th>Resultado</th>
                          <th>Referencia do laudo</th>
                          <th>Laboratorio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...active.points].reverse().map((point) => (
                          <tr key={`${point.examId}-${point.id}`}>
                            <td>{formatDate(point.date)}</td>
                            <td>
                              <strong>{formatNumber(point.value)}</strong>{" "}
                              <span className="muted">{point.unit}</span>
                            </td>
                            <td>{point.reference || "Nao informada"}</td>
                            <td>{point.laboratory}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="dashboard-footer">
            <span>
              <LockKeyhole size={13} />
              {demo
                ? "Dados de exemplo · Sem armazenamento permanente"
                : "Historico pessoal · Uma conta por pessoa"}
            </span>
            <span>Informacao, nao diagnostico.</span>
          </footer>
        </main>
      </div>
      {editor && (
        <ExamEditor
          demo={demo}
          onClose={() => setEditor(false)}
          onSave={onSave}
        />
      )}
      {deleting && (
        <div className="modal-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Excluir este exame?</h2>
            <p>
              Os resultados serao removidos do seu historico e dos comparativos.
              Esta acao nao pode ser desfeita.
            </p>
            {deleteError && (
              <p role="alert" className="error-message">
                {deleteError}
              </p>
            )}
            <div>
              <button
                autoFocus
                className="button"
                disabled={deleteBusy}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                className="button destructive"
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Excluir exame
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [demo, setDemo] = useState(false);
  const [checking, setChecking] = useState(!DEMO_ONLY);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (DEMO_ONLY) return;
    let cancelled = false;
    void getSession()
      .then((current) => {
        if (!cancelled) {
          setSession(current);
          setLoading(Boolean(current));
        }
      })
      .catch(() => {
        if (!cancelled)
          setMessage(
            "Servidor local indisponivel. Inicie o sistema com npm run dev.",
          );
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    function expired() {
      setSession(null);
      setExams([]);
      setDemo(false);
      setLoading(false);
      setMessage("Sua sessao expirou. Entre novamente.");
    }
    window.addEventListener("linha-session-expired", expired);
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("linha-auth");
    if (channel)
      channel.onmessage = (event) => {
        if (event.data?.source !== authTabId) window.location.reload();
      };
    return () => {
      cancelled = true;
      window.removeEventListener("linha-session-expired", expired);
      channel?.close();
    };
  }, []);
  useEffect(() => {
    if (!session?.user.id || demo) return;
    let cancelled = false;
    void fetchExams()
      .then((items) => {
        if (!cancelled) setExams(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, demo, retry]);
  async function addExam(exam: Exam) {
    if (!demo) {
      if (!session) throw new Error("Sua sessao expirou. Entre novamente.");
      await saveExam(exam);
    }
    setExams((current) => [...current, exam]);
  }
  async function removeExam(id: string) {
    if (!demo) await deleteExam(id);
    setExams((current) => current.filter((exam) => exam.id !== id));
  }
  async function logout() {
    if (!demo && session) {
      setLoading(true);
      try {
        await signOut();
      } catch (error) {
        setMessage(errorMessage(error));
        setLoading(false);
        return;
      }
    }
    setDemo(false);
    setExams([]);
    setMessage("");
    setLoading(false);
    setSession(null);
  }
  if (checking)
    return (
      <main className="loading-state" role="status">
        <LoaderCircle className="spin" size={24} />
        Conectando ao servidor local...
      </main>
    );
  if (!session && !demo)
    return (
      <Auth
        initialMessage={message}
        onAuthenticated={(current) => {
          setExams([]);
          setMessage("");
          setLoading(true);
          setSession(current);
          setDemo(false);
        }}
        onDemo={() => {
          setDemo(true);
          setExams(structuredClone(demoExams));
          setMessage("");
          setLoading(false);
        }}
      />
    );
  return (
    <Dashboard
      key={demo ? "demo" : session?.user.id}
      exams={exams}
      demo={demo}
      email={session?.user.email}
      loading={loading}
      message={message}
      onSave={addExam}
      onDelete={removeExam}
      onLogout={() => void logout()}
      onRetry={() => {
        setLoading(true);
        setExams([]);
        setMessage("");
        setRetry((current) => current + 1);
      }}
    />
  );
}

export default App;
