import { type FC, ReactNode, useState } from "react";
import { Archive } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useUpdateTableMutation from "@/hooks/use-update-table-mutation";
import DataSchemaForm from "@/screens/main-stack/data-tables-screen/data-schema-dialog/data-schema-form";
import { type CreateOrUpdateTable, type DataTableSchema } from "../../../../../shared/schemas";

export interface EditTableDialogButtonProps {
  children: (open: () => void, close: () => void) => ReactNode;
  table: DataTableSchema;
}

const EditTableDialogButton: FC<EditTableDialogButtonProps> = (props) => {
  const { children, table } = props;
  const [isOpen, setIsOpen] = useState(false);
  const { updateTable, isUpdateTableLoading } = useUpdateTableMutation(table.id);

  const defaultValues: CreateOrUpdateTable = {
    columns: table.columns,
    description: table.description,
    name: table.name
  };

  const onUpdateTable = async (input: CreateOrUpdateTable) => {
    await updateTable(input);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children(
        () => setIsOpen(true),
        () => setIsOpen(false)
      )}

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Edit Table
          </DialogTitle>
          <DialogDescription>Edit this user table schema in the current Chisel project.</DialogDescription>
        </DialogHeader>
        <DataSchemaForm
          defaultValues={defaultValues}
          disabled={isUpdateTableLoading}
          onCancel={() => setIsOpen(false)}
          onSave={onUpdateTable}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditTableDialogButton;
