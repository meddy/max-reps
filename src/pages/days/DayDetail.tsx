import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDataAccess } from "../../contexts/DataAccessContext";
import type { Day, TemplateWithExerciseName } from "../../types";
import { ExercisePicker } from "../../components/ExercisePicker";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { IconPencil, IconTrash } from "../../components/Icons";
import { LoadErrorPanel } from "../../components/LoadErrorPanel";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useRemoteLoad } from "../../hooks/useRemoteLoad";
import { Modal } from "../../components/Modal";
import { DragOverlayChip } from "../../lib/dnd/DragOverlayChip";
import {
  GuardedPointerSensor,
  GuardedTouchSensor,
} from "../../lib/dnd/guardedSensors";
import { SortableDragPlaceholder } from "../../lib/dnd/SortableDragPlaceholder";

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

type TemplateOrderUpdate = { id: string; order: number };

export function buildTemplateReorderResult(
  templates: TemplateWithExerciseName[],
  activeId: string,
  overId: string
): {
  nextTemplates: TemplateWithExerciseName[];
  updates: TemplateOrderUpdate[];
} | null {
  const oldIndex = templates.findIndex((t) => t.id === activeId);
  const newIndex = templates.findIndex((t) => t.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null;

  const previousOrderById = new Map(templates.map((t) => [t.id, t.order]));
  const reordered = arrayMove(templates, oldIndex, newIndex);
  const nextTemplates = reordered.map((t, index) =>
    t.order === index ? t : { ...t, order: index }
  );
  const updates = nextTemplates
    .filter((t) => previousOrderById.get(t.id) !== t.order)
    .map((t) => ({ id: t.id, order: t.order }));
  return { nextTemplates, updates };
}

type SortableTemplateRowProps = {
  template: TemplateWithExerciseName;
  isEditing: boolean;
  isDragGestureActive: boolean;
  onBeginEdit: (template: TemplateWithExerciseName) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (templateId: string) => void;
  editNumSets: string;
  editRepsLower: string;
  editRepsUpper: string;
  setEditNumSets: (value: string) => void;
  setEditRepsLower: (value: string) => void;
  setEditRepsUpper: (value: string) => void;
};

function SortableTemplateRow({
  template,
  isEditing,
  isDragGestureActive,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  editNumSets,
  editRepsLower,
  editRepsUpper,
  setEditNumSets,
  setEditRepsLower,
  setEditRepsUpper,
}: SortableTemplateRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: template.id,
    disabled: isEditing,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        userSelect: isDragGestureActive ? "none" : undefined,
        WebkitUserSelect: isDragGestureActive ? "none" : undefined,
      }}
      className={
        isDragging
          ? ""
          : "flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-100"
      }
      {...attributes}
      {...listeners}
    >
      {isDragging ? (
        <SortableDragPlaceholder />
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <Link
              to={`/exercises/${template.exerciseId}`}
              className="font-medium text-gray-900 hover:text-indigo-700"
            >
              {template.exerciseDisplayName}
            </Link>
            <p className="text-sm text-gray-500">
              {isEditing ? (
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
                `${template.numSets} × ${template.repsLower}–${template.repsUpper} reps`
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => void onSaveEdit()}
                  className="min-h-[44px] rounded-lg px-2 text-sm text-indigo-600 hover:bg-indigo-100"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="min-h-[44px] rounded-lg px-2 text-sm text-gray-500"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onBeginEdit(template)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
                  aria-label="Edit Set Target"
                  title="Edit Set Target"
                >
                  <IconPencil className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(template.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
                  aria-label="Delete Set Target"
                  title="Delete Set Target"
                >
                  <IconTrash className="size-6" />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export function DayDetail() {
  const dataAccess = useDataAccess();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [day, setDay] = useState<(Day & { id: string }) | null>(null);
  const [templates, setTemplates] = useState<TemplateWithExerciseName[]>([]);
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
  const [isDragGestureActive, setIsDragGestureActive] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(GuardedPointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(GuardedTouchSensor, {
      activationConstraint: { delay: 140, tolerance: 8 },
    })
  );

  const loadTemplates = useCallback(async () => {
    if (!id) return;
    const list = await dataAccess.templates.listForDayWithExerciseNames(id);
    setTemplates(list);
  }, [dataAccess, id]);

  const loadInitial = useCallback(
    async ({ isStale }: { isStale: () => boolean }) => {
      if (!id) return;
      const d = await dataAccess.days.get(id);
      if (isStale()) return;
      if (!d) {
        setDay(null);
        setTemplates([]);
        return;
      }
      setDay(d as Day & { id: string });
      const list = await dataAccess.templates.listForDayWithExerciseNames(id);
      if (isStale()) return;
      setTemplates(list);
    },
    [dataAccess, id]
  );

  const { loading, loadError, reload } = useRemoteLoad({
    load: loadInitial,
    deps: [id],
  });

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    setIsDragGestureActive(true);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setIsDragGestureActive(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    setIsDragGestureActive(false);
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const result = buildTemplateReorderResult(templates, activeId, overId);
    if (!result || result.updates.length === 0) return;

    const previousTemplates = templates;
    setTemplates(result.nextTemplates);
    try {
      await dataAccess.templates.reorder(result.updates);
    } catch {
      setTemplates(previousTemplates);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <LoadErrorPanel
          title="Could not load Day."
          message={loadError}
          onRetry={() => void reload()}
        />
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
          title="No exercises in this Day"
          description="Add Set Targets to build this Day."
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={(event) => void handleDragEnd(event)}
          autoScroll
        >
          <SortableContext
            items={templates.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2">
              {templates.map((template) => (
                <SortableTemplateRow
                  key={template.id}
                  template={template}
                  isEditing={editingTemplateId === template.id}
                  isDragGestureActive={isDragGestureActive}
                  onBeginEdit={(t) => {
                    setEditingTemplateId(t.id);
                    setEditNumSets(String(t.numSets));
                    setEditRepsLower(String(t.repsLower));
                    setEditRepsUpper(String(t.repsUpper));
                  }}
                  onCancelEdit={() => setEditingTemplateId(null)}
                  onSaveEdit={() => void handleSaveEdit()}
                  onDelete={(templateId) => setDeleteTemplateId(templateId)}
                  editNumSets={editNumSets}
                  editRepsLower={editRepsLower}
                  editRepsUpper={editRepsUpper}
                  setEditNumSets={setEditNumSets}
                  setEditRepsLower={setEditRepsLower}
                  setEditRepsUpper={setEditRepsUpper}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeDragId ? (
              <DragOverlayChip
                label={
                  templates.find((t) => t.id === activeDragId)
                    ?.exerciseDisplayName ?? ""
                }
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Set Target"
      >
        <ExercisePicker
          active={addOpen}
          flow="staged"
          stagedConfirmLabel="Add Set Target"
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
        message="Remove this Set Target?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteTemplate()}
        onCancel={() => setDeleteTemplateId(null)}
      />
    </div>
  );
}
