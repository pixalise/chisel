import DataSchemaForm from "@/components/data-schema/data-schema-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useAddTableMutation from "@/hooks/use-add-table-mutation"
import { type CreateOrUpdateTable } from "@/shared/schemas"
import { Archive } from "lucide-react"
import type { ReactNode } from "react"
import { type FC, useState } from "react"
export interface CreateTableDialogButtonProps {
  children: (open: () => void, close: () => void) => ReactNode
}
const CreateTableDialogButton: FC<CreateTableDialogButtonProps> = (props) => {
  const { children } = props
  const [isOpen, setIsOpen] = useState(false)
  const { addTable, isAddTableLoading } = useAddTableMutation()
  const onAddTable = async (input: CreateOrUpdateTable) => {
    await addTable(input)
    setIsOpen(false)
  }
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
            Create Table
          </DialogTitle>
          <DialogDescription>
            Create a user table schema in the current Chisel project.
          </DialogDescription>
        </DialogHeader>
        <DataSchemaForm
          disabled={isAddTableLoading}
          onCancel={() => setIsOpen(false)}
          onSave={onAddTable}
        />
      </DialogContent>
    </Dialog>
  )
}
export default CreateTableDialogButton
