import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDataAccess } from "../../contexts/DataAccessContext";
import type { Day, TemplateWithExerciseName } from "../../types";
import { ExercisePicker } from "../../components/ExercisePicker";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { IconPencil, IconTrash } from "../../components/Icons";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";

function parseTemplateFieldStrings(
  numSetsStr: string,
  repsLowerStr: string,
  repsUpperStr: string
): { numSets: number; repsLower: number; repsUpper: number } {
  const rawSets = Number(numSetsStr.trim());
  const numSets =
    Number.isFinite(rawSets) && rawSets >= 1 ? Math.floor(rawSets) : 1;

  const parseRep = (s: string): number => {
    const n = Number(s.trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  let repsLower = parseRep(repsLowerStr);
  let repsUpper = parseRep(repsUpperStr);
  if (repsLower > repsUpper) {
    [repsLower, repsUpper] = [repsUpper, repsLower];
  }

  return { numSets, repsLower, repsUpper };
}

export function DayDetail() {
  const dataAccess = useDataAccess();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [day, setDay] = useState<(Day & { id: string }) | null>(null);
  const [templates, setTemplates] = useState<TemplateWithExerciseName[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newNumSets, setNewNumSets] = useState("3");
  const [newRepsLower, setNewRepsLower] = useState("8");
  const [newRepsUpper, setNewRepsUpper] = useState("12");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [editNumSets, setEditNumSets] = useState("");
  const [editRepsLower, setEditRepsLower] = useState("");
  const [editRepsUpper, setEditRepsUpper] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const loadDay = useCallback(async () => {
    if (!id) return;
    const d = await dataAccess.days.get(id);
    if (!d) {
      setDay(null);
      setLoading(false);
      return;
    }
    setDay(d as Day & { id: string });
    setLoading(false);
  }, [dataAccess, id]);

  const loadTemplates = useCallback(async () => {
    if (!id) return;
    const list = await dataAccess.templates.listForDayWithExerciseNames(id);
    setTemplates(list);
  }, [dataAccess, id]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleAddTemplate = async (exerciseId: string) => {
    if (!id) return;
    const maxOrder =
      templates.length > 0 ? Math.max(...templates.map((t) => t.order)) : -1;
    const { numSets, repsLower, repsUpper } = parseTemplateFieldStrings(
      newNumSets,
      newRepsLower,
      newRepsUpper
    );
    await dataAccess.templates.create({
      dayId: id,
      exerciseId,
      numSets,
      repsLower,
      repsUpper,
      order: maxOrder + 1,
    });
    setAddOpen(false);
    setNewNumSets("3");
    setNewRepsLower("8");
    setNewRepsUpper("12");
    void loadTemplates();
  };

  const handleSaveEdit = async () => {
    if (!editingTemplateId) return;
    const { numSets, repsLower, repsUpper } = parseTemplateFieldStrings(
      editNumSets,
      editRepsLower,
      editRepsUpper
    );
    await dataAccess.templates.update(editingTemplateId, {
      numSets,
      repsLower,
      repsUpper,
    });
    setEditingTemplateId(null);
    void loadTemplates();
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    await dataAccess.templates.delete(deleteTemplateId);
    setDeleteTemplateId(null);
    void loadTemplates();
  };

  const moveTemplate = async (index: number, direction: "up" | "down") => {
    const newOrder = direction === "up" ? index - 1 : index + 1;
    if (newOrder < 0 || newOrder >= templates.length) return;
    const a = templates[index];
    const b = templates[newOrder];
    await Promise.all([
      dataAccess.templates.update(a.id, { order: newOrder }),
      dataAccess.templates.update(b.id, { order: index }),
    ]);
    void loadTemplates();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!day) {
    return (
      <div>
        <p className="text-gray-500">Day not found.</p>
        <button
          type="button"
          onClick={() => navigate("/days")}
          className="mt-2 text-indigo-600 hover:underline"
        >
          Back to Days
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {day.displayName}
        </h2>
        <button
          type="button"
          onClick={() => navigate("/days")}
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Back to Days
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add exercise
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No exercises in this day"
          description="Add exercises to build your template."
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add exercise
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((t, index) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-100"
            >
              <div>
                <Link
                  to={`/exercises/${t.exerciseId}`}
                  className="font-medium text-gray-900 hover:text-indigo-700"
                >
                  {t.exerciseDisplayName}
                </Link>
                <p className="text-sm text-gray-500">
                  {editingTemplateId === t.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={editNumSets}
                        onChange={(e) => setEditNumSets(e.target.value)}
                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      sets ×
                      <input
                        type="number"
                        min={0}
                        value={editRepsLower}
                        onChange={(e) => setEditRepsLower(e.target.value)}
                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      –
                      <input
                        type="number"
                        min={0}
                        value={editRepsUpper}
                        onChange={(e) => setEditRepsUpper(e.target.value)}
                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      reps
                    </span>
                  ) : (
                    `${t.numSets} × ${t.repsLower}–${t.repsUpper} reps`
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {editingTemplateId === t.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      className="min-h-[44px] rounded-lg px-2 text-sm text-indigo-600 hover:bg-indigo-100"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTemplateId(null)}
                      className="min-h-[44px] rounded-lg px-2 text-sm text-gray-500"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => moveTemplate(index, "up")}
                      disabled={index === 0}
                      className="min-h-[44px] min-w-[44px] rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTemplate(index, "down")}
                      disabled={index === templates.length - 1}
                      className="min-h-[44px] min-w-[44px] rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplateId(t.id);
                        setEditNumSets(String(t.numSets));
                        setEditRepsLower(String(t.repsLower));
                        setEditRepsUpper(String(t.repsUpper));
                      }}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
                      aria-label="Edit template"
                      title="Edit template"
                    >
                      <IconPencil className="size-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTemplateId(t.id)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
                      aria-label="Delete template"
                      title="Delete template"
                    >
                      <IconTrash className="size-6" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add exercise to day"
      >
        <ExercisePicker
          active={addOpen}
          flow="staged"
          stagedConfirmLabel="Add template"
          onStagedCancel={() => setAddOpen(false)}
          onCommit={(ex) => void handleAddTemplate(ex.id)}
          renderStagedAccessory={() => (
            <div className="mt-4 flex flex-col gap-2">
              <div className="grid grid-cols-[minmax(5rem,auto)_1fr] items-center gap-x-3 gap-y-2">
                <label className="text-sm text-gray-600" htmlFor="add-num-sets">
                  Sets:
                </label>
                <input
                  id="add-num-sets"
                  type="number"
                  min={1}
                  value={newNumSets}
                  onChange={(e) => setNewNumSets(e.target.value)}
                  className="w-16 rounded border border-gray-300 px-2 py-1"
                />
                <label
                  className="text-sm text-gray-600"
                  htmlFor="add-reps-lower"
                >
                  Rep range:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="add-reps-lower"
                    type="number"
                    min={0}
                    value={newRepsLower}
                    onChange={(e) => setNewRepsLower(e.target.value)}
                    className="w-14 rounded border border-gray-300 px-2 py-1"
                  />
                  <span className="text-gray-500">–</span>
                  <input
                    id="add-reps-upper"
                    type="number"
                    min={0}
                    value={newRepsUpper}
                    onChange={(e) => setNewRepsUpper(e.target.value)}
                    className="w-14 rounded border border-gray-300 px-2 py-1"
                  />
                </div>
              </div>
            </div>
          )}
        />
      </Modal>

      <ConfirmDialog
        open={deleteTemplateId != null}
        title="Remove exercise"
        message="Remove this exercise from the day template?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteTemplate()}
        onCancel={() => setDeleteTemplateId(null)}
      />
    </div>
  );
}
