import { Modal } from "./Modal";
import { ExercisePicker } from "./ExercisePicker";

export interface AddExerciseModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (exerciseId: string, exerciseName: string) => void;
}

export function AddExerciseModal({
  open,
  onClose,
  onAdd,
}: AddExerciseModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Add exercise to workout">
      <ExercisePicker
        active={open}
        flow="staged"
        stagedConfirmLabel="Add"
        onStagedCancel={onClose}
        onCommit={(ex) => {
          onAdd(ex.id, ex.displayName);
          onClose();
        }}
      />
    </Modal>
  );
}
