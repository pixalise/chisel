import { type FC, useState } from "react";
import { Plus } from "lucide-react";
import Section from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useListProjectTodosQuery from "@/hooks/use-list-project-todos-query";
import useProjectTodoMutations from "@/hooks/use-project-todo-mutations";
import type { CreateOrUpdateProjectTodo, ProjectTodo } from "../../../../shared/project-management";
import ProjectTodoForm from "./project-todo-form";
import TodoItem from "./todo-item";

const TodoScreen: FC = () => {
  const { todos } = useListProjectTodosQuery();
  const mutations = useProjectTodoMutations();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const activeTodos = todos.filter((todo) => !todo.archivedAt);
  const archivedTodos = todos.filter((todo) => todo.archivedAt);

  async function addTodo(input: CreateOrUpdateProjectTodo): Promise<void> {
    await mutations.addTodo(input);
    setIsAddOpen(false);
  }

  return (
    <Section
      title="Project Management"
      copy="Project-local todos, subitems, priorities, and due dates."
      actions={[
        <Button
          disabled={mutations.isProjectTodoMutating}
          key="add-todo"
          onClick={() => setIsAddOpen(true)}
          type="button"
          variant="secondary"
        >
          <Plus className="size-4" />
          Add Todo
        </Button>
      ]}
    >
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeTodos.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedTodos.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <TodoList emptyLabel="No active todos." isArchived={false} mutations={mutations} todos={activeTodos} />
        </TabsContent>
        <TabsContent value="archived">
          <TodoList emptyLabel="No archived todos." isArchived mutations={mutations} todos={archivedTodos} />
        </TabsContent>
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Todo</DialogTitle>
            <DialogDescription>Create a project checklist item.</DialogDescription>
          </DialogHeader>
          <ProjectTodoForm disabled={mutations.isProjectTodoMutating} onCancel={() => setIsAddOpen(false)} onSave={addTodo} />
        </DialogContent>
      </Dialog>
    </Section>
  );
};

interface TodoListProps {
  emptyLabel: string;
  isArchived: boolean;
  mutations: ReturnType<typeof useProjectTodoMutations>;
  todos: ProjectTodo[];
}

const TodoList: FC<TodoListProps> = (props) => {
  const { emptyLabel, isArchived, mutations, todos } = props;
  if (todos.length === 0) {
    return <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {todos.map((todo, index) => (
        <TodoItem
          isArchived={isArchived}
          isFirst={index === 0}
          isLast={index === todos.length - 1}
          key={todo.id}
          mutations={mutations}
          todo={todo}
        />
      ))}
    </div>
  );
};

export default TodoScreen;
