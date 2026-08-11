import React, { useEffect, useState } from "react";

interface KanbanColumn {
  id: string;
  title: string;
}

interface KanbanCard {
  id: string;
  columnId: string;
  title: string;
  link?: string;
  deadline?: string;
  note?: string;
  createdAt: number;
  // Set only for cards created by "Sync from hh.ru" - lets re-syncing add
  // new responses without duplicating cards the user already has.
  sourceId?: string;
}

interface KanbanState {
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

const DEFAULT_BOARD: KanbanState = {
  columns: [
    { id: "todo", title: "Надо откликнуться" },
    { id: "waiting", title: "Жду ответа" },
    { id: "feedback", title: "Есть фидбэк" },
    { id: "done", title: "Отказ или оффер" },
  ],
  cards: [],
};

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface Negotiation {
  id: string;
  state: string;
  vacancy_name: string | null;
  vacancy_url: string | null;
  employer_name: string | null;
  created_at: string;
}

// hh.ru negotiation states aren't a fixed local enum (the app just stores
// whatever string state.id the API returns) - match by substring so
// unfamiliar states still land somewhere reasonable instead of erroring.
const mapStateToColumn = (state: string, columns: KanbanColumn[]): string => {
  const s = (state || "").toLowerCase();
  const byId = (id: string) => columns.find((c) => c.id === id)?.id;
  if (s.includes("invit")) return byId("feedback") || columns[Math.min(2, columns.length - 1)].id;
  if (s.includes("discard") || s.includes("reject")) return byId("done") || columns[columns.length - 1].id;
  return byId("waiting") || columns[Math.min(1, columns.length - 1)].id;
};

const formatDateTime = (value: number | string) => {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return isNaN(date.getTime()) ? "" : date.toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const KanbanBoard: React.FC = () => {
  const [board, setBoard] = useState<KanbanState>(DEFAULT_BOARD);
  const [loaded, setLoaded] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    (async () => {
      const config = await window.electronAPI.getConfig();
      if (config.kanban_board?.columns?.length) {
        setBoard(config.kanban_board);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = async (next: KanbanState) => {
    setBoard(next);
    const config = await window.electronAPI.getConfig();
    await window.electronAPI.setConfig({ ...config, kanban_board: next });
  };

  const handleDrop = (columnId: string) => {
    if (!draggingId) return;
    const next = {
      ...board,
      cards: board.cards.map((c) => (c.id === draggingId ? { ...c, columnId } : c)),
    };
    setDraggingId(null);
    persist(next);
  };

  const handleAddCard = (columnId: string) => {
    if (!newTitle.trim()) return;
    const card: KanbanCard = {
      id: genId(),
      columnId,
      title: newTitle.trim(),
      link: newLink.trim() || undefined,
      deadline: newDeadline || undefined,
      createdAt: Date.now(),
    };
    persist({ ...board, cards: [...board.cards, card] });
    setNewTitle("");
    setNewLink("");
    setNewDeadline("");
    setAddingToColumn(null);
  };

  const handleDeleteCard = (id: string) => {
    persist({ ...board, cards: board.cards.filter((c) => c.id !== id) });
  };

  const handleUpdateNote = (id: string, note: string) => {
    persist({ ...board, cards: board.cards.map((c) => (c.id === id ? { ...c, note } : c)) });
  };

  const handleSyncFromHH = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const negotiations: Negotiation[] = (await window.electronAPI.callHHTool("get_negotiations_from_db")) || [];
      const known = new Set(board.cards.map((c) => c.sourceId).filter(Boolean));
      const newCards: KanbanCard[] = negotiations
        .filter((n) => !known.has(n.id))
        .map((n) => {
          const createdAt = new Date(n.created_at).getTime();
          return {
            id: genId(),
            sourceId: n.id,
            columnId: mapStateToColumn(n.state, board.columns),
            title: n.vacancy_name || n.id,
            link: n.vacancy_url || undefined,
            note: n.employer_name || undefined,
            createdAt: isNaN(createdAt) ? Date.now() : createdAt,
          };
        });
      if (newCards.length) {
        await persist({ ...board, cards: [...board.cards, ...newCards] });
      }
    } catch {
      setSyncError("Не удалось получить отклики - проверь подключение на вкладке Jobs.");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddColumn = () => {
    const title = window.prompt("Название колонки");
    if (!title?.trim()) return;
    persist({ ...board, columns: [...board.columns, { id: genId(), title: title.trim() }] });
  };

  const handleRenameColumn = (id: string) => {
    if (!columnTitleDraft.trim()) {
      setEditingColumn(null);
      return;
    }
    persist({
      ...board,
      columns: board.columns.map((c) => (c.id === id ? { ...c, title: columnTitleDraft.trim() } : c)),
    });
    setEditingColumn(null);
  };

  const handleDeleteColumn = (id: string) => {
    if (board.cards.some((c) => c.columnId === id)) {
      if (!window.confirm("Эта колонка содержит карточки - удалить вместе с ними?")) return;
    }
    persist({
      columns: board.columns.filter((c) => c.id !== id),
      cards: board.cards.filter((c) => c.columnId !== id),
    });
  };

  if (!loaded) return <p className="text-xs opacity-50">Loading board...</p>;

  return (
    <div className="flex flex-col h-full text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs opacity-60">Kanban - организация поиска работы</span>
        <div className="flex items-center gap-1">
          <button onClick={handleSyncFromHH} disabled={syncing} className="btn btn-ghost btn-xs" title="Добавить карточки по откликам с hh.ru">
            {syncing ? "..." : "🔄 Синхронизировать с hh.ru"}
          </button>
          <button onClick={handleAddColumn} className="btn btn-ghost btn-xs">
            + Колонка
          </button>
        </div>
      </div>
      {syncError && <p className="text-xs text-error mb-2">{syncError}</p>}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-2 h-full" style={{ minWidth: "max-content" }}>
          {board.columns.map((col) => (
            <div
              key={col.id}
              className="card-surface bg-base-200 p-2 flex flex-col"
              style={{ width: 220 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="flex items-center justify-between mb-2 gap-1">
                {editingColumn === col.id ? (
                  <input
                    autoFocus
                    className="input input-bordered input-xs flex-1 bg-base-100"
                    value={columnTitleDraft}
                    onChange={(e) => setColumnTitleDraft(e.target.value)}
                    onBlur={() => handleRenameColumn(col.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameColumn(col.id)}
                  />
                ) : (
                  <span
                    className="text-xs font-semibold truncate cursor-pointer"
                    onClick={() => {
                      setEditingColumn(col.id);
                      setColumnTitleDraft(col.title);
                    }}
                    title="Click to rename"
                  >
                    {col.title} ({board.cards.filter((c) => c.columnId === col.id).length})
                  </span>
                )}
                <button onClick={() => handleDeleteColumn(col.id)} className="opacity-40 hover:opacity-100 flex-shrink-0" title="Delete column">
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {board.cards
                  .filter((c) => c.columnId === col.id)
                  .map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggingId(card.id)}
                      className="card-surface interactive bg-base-100 p-2 cursor-move"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-medium">{card.title}</span>
                        <button onClick={() => handleDeleteCard(card.id)} className="opacity-40 hover:opacity-100 flex-shrink-0 text-xs">
                          ✕
                        </button>
                      </div>
                      {card.link && (
                        <button
                          onClick={() => window.electronAPI.openExternal(card.link!)}
                          className="text-xs opacity-60 hover:opacity-100 truncate block"
                        >
                          🔗 открыть вакансию
                        </button>
                      )}
                      {card.deadline && <div className="text-xs opacity-50">📅 {formatDateTime(card.deadline)}</div>}
                      {card.createdAt && <div className="text-xs opacity-40">Добавлено {formatDateTime(card.createdAt)}</div>}
                      {editingCard === card.id ? (
                        <textarea
                          autoFocus
                          className="textarea textarea-bordered textarea-xs w-full mt-1 bg-base-200"
                          rows={2}
                          defaultValue={card.note || ""}
                          onBlur={(e) => {
                            handleUpdateNote(card.id, e.target.value);
                            setEditingCard(null);
                          }}
                        />
                      ) : (
                        <p
                          className="text-xs opacity-70 mt-1 cursor-text min-h-[1em]"
                          onClick={() => setEditingCard(card.id)}
                        >
                          {card.note || "+ заметка"}
                        </p>
                      )}
                    </div>
                  ))}
              </div>

              {addingToColumn === col.id ? (
                <div className="space-y-1 mt-2">
                  <input
                    autoFocus
                    className="input input-bordered input-xs w-full bg-base-100"
                    placeholder="Название (например Ozon - Backend)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <input
                    className="input input-bordered input-xs w-full bg-base-100"
                    placeholder="Ссылка на вакансию (опционально)"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                  />
                  <input
                    type="datetime-local"
                    className="input input-bordered input-xs w-full bg-base-100"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                  />
                  <div className="flex gap-1">
                    <button onClick={() => handleAddCard(col.id)} className="btn btn-primary btn-xs flex-1">
                      Добавить
                    </button>
                    <button onClick={() => setAddingToColumn(null)} className="btn btn-ghost btn-xs">
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingToColumn(col.id)} className="btn btn-ghost btn-xs w-full mt-2">
                  + Карточка
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;
