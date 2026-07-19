import { type FC, type ReactNode, useState } from "react";
import { Archive, CalendarDays, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UseProjectTodoMutations } from "@/hooks/use-project-todo-mutations";
import { cn } from "@/lib/utils";
import {
  type CreateOrUpdateProjectSubitem,
  type CreateOrUpdateProjectTodo,
  type ProjectTodo,
  ProjectTodoPriority,
  type ProjectTodoSubitem,
  projectTodoPriorityLabelMap
} from "../../../../shared/project-management";
import ProjectSubitemForm from "./project-subitem-form";
import ProjectTodoForm from "./project-todo-form";

export interface TodoItemProps {
  isArchived: boolean;
  mutations: UseProjectTodoMutations;
  todo: ProjectTodo;
}

interface ConfirmRemoveButtonProps {
  children: ReactNode;
  description: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
  title: string;
}

function priorityClassName(priority: ProjectTodoPriority): string {
  if (priority === ProjectTodoPriority.urgent) {
    return "border-destructive/50 text-destructive";
  }
  if (priority === ProjectTodoPriority.high) {
    return "border-amber-500/60 text-amber-600";
  }
  if (priority === ProjectTodoPriority.low) {
    return "border-border text-muted-foreground";
  }
  return "border-primary/40 text-primary";
}

const ConfirmRemoveButton: FC<ConfirmRemoveButtonProps> = (props) => {
  const { children, description, disabled, onConfirm, title } = props;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} size="sm" type="button" variant="ghost">
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              void onConfirm();
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const TodoItem: FC<TodoItemProps> = (props) => {
  const { isArchived, mutations, todo } = props;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddSubitemOpen, setIsAddSubitemOpen] = useState(false);
  const completedSubitems = todo.subitems.filter((subitem) => subitem.completed).length;
  const isBusy = mutations.isProjectTodoMutating;

  async function updateTodo(input: CreateOrUpdateProjectTodo): Promise<void> {
    await mutations.updateTodo({ todoId: todo.id, input });
    setIsEditOpen(false);
  }

  async function addSubitem(input: CreateOrUpdateProjectSubitem): Promise<void> {
    await mutations.addSubitem({ todoId: todo.id, input });
    setIsAddSubitemOpen(false);
  }

  return (
    <article className={cn("border border-border bg-card p-3", todo.completed && "opacity-75")}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <Checkbox
          aria-label={`Complete ${todo.title}`}
          checked={todo.completed}
          disabled={isBusy}
          onCheckedChange={(checked) => {
            void mutations.toggleTodoCompleted({ todoId: todo.id, completed: checked === true });
          }}
        />
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <strong className={cn("truncate text-sm", todo.completed && "line-through")}>{todo.title}</strong>
            <Badge className={priorityClassName(todo.priority)} variant="outline">
              {projectTodoPriorityLabelMap[todo.priority]}
            </Badge>
            {todo.dueDate && (
              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {todo.dueDate}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {completedSubitems}/{todo.subitems.length} subitems
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Button disabled={isBusy} onClick={() => setIsEditOpen(true)} size="sm" type="button" variant="ghost">
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button disabled={isBusy} onClick={() => setIsAddSubitemOpen(true)} size="sm" type="button" variant="ghost">
            <Plus className="size-4" />
            Subitem
          </Button>
          <Button
            disabled={isBusy}
            onClick={() => {
              void (isArchived ? mutations.unarchiveTodo(todo.id) : mutations.archiveTodo(todo.id));
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
            {isArchived ? "Unarchive" : "Archive"}
          </Button>
          <ConfirmRemoveButton
            description={`This permanently removes "${todo.title}" and its subitems.`}
            disabled={isBusy}
            title="Remove todo?"
            onConfirm={() => mutations.removeTodo(todo.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </ConfirmRemoveButton>
        </div>
      </div>

      {todo.subitems.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border pt-2">
          {todo.subitems.map((subitem) => (
            <SubitemRow isBusy={isBusy} key={subitem.id} mutations={mutations} subitem={subitem} todo={todo} />
          ))}
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Todo</DialogTitle>
            <DialogDescription>Update this project checklist item.</DialogDescription>
          </DialogHeader>
          <ProjectTodoForm
            defaultValues={{ title: todo.title, priority: todo.priority, dueDate: todo.dueDate }}
            disabled={isBusy}
            onCancel={() => setIsEditOpen(false)}
            onSave={updateTodo}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isAddSubitemOpen} onOpenChange={setIsAddSubitemOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Subitem</DialogTitle>
            <DialogDescription>Add a checklist item under {todo.title}.</DialogDescription>
          </DialogHeader>
          <ProjectSubitemForm disabled={isBusy} onCancel={() => setIsAddSubitemOpen(false)} onSave={addSubitem} />
        </DialogContent>
      </Dialog>
    </article>
  );
};

interface SubitemRowProps {
  isBusy: boolean;
  mutations: UseProjectTodoMutations;
  subitem: ProjectTodoSubitem;
  todo: ProjectTodo;
}

const SubitemRow: FC<SubitemRowProps> = (props) => {
  const { isBusy, mutations, subitem, todo } = props;
  const [isEditOpen, setIsEditOpen] = useState(false);

  async function updateSubitem(input: CreateOrUpdateProjectSubitem): Promise<void> {
    await mutations.updateSubitem({ todoId: todo.id, subitemId: subitem.id, input });
    setIsEditOpen(false);
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-1 py-1">
      <Checkbox
        aria-label={`Complete ${subitem.title}`}
        checked={subitem.completed}
        disabled={isBusy}
        onCheckedChange={(checked) => {
          void mutations.toggleSubitemCompleted({ todoId: todo.id, subitemId: subitem.id, completed: checked === true });
        }}
      />
      <span className={cn("truncate text-sm", subitem.completed && "text-muted-foreground line-through")}>{subitem.title}</span>
      <div className="flex justify-end gap-1">
        <Button disabled={isBusy} onClick={() => setIsEditOpen(true)} size="sm" type="button" variant="ghost">
          <Pencil className="size-4" />
          Edit
        </Button>
        <ConfirmRemoveButton
          description={`This permanently removes "${subitem.title}".`}
          disabled={isBusy}
          title="Remove subitem?"
          onConfirm={() => mutations.removeSubitem({ todoId: todo.id, subitemId: subitem.id })}
        >
          <Trash2 className="size-4" />
          Delete
        </ConfirmRemoveButton>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Subitem</DialogTitle>
            <DialogDescription>Update this checklist subitem.</DialogDescription>
          </DialogHeader>
          <ProjectSubitemForm
            defaultValues={{ title: subitem.title }}
            disabled={isBusy}
            onCancel={() => setIsEditOpen(false)}
            onSave={updateSubitem}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TodoItem;
