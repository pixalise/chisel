import { type FC } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SlugInput from "@/components/controls/slug-input";
import { Label } from "@/components/ui/label";
import type { PossibleValuesEditorProps } from "./data-schema-column-editor.types";

const PossibleValuesEditor: FC<PossibleValuesEditorProps> = (props) => {
  const { disabled, enumValues, onAddPossibleValue, onPossibleValueInputChange, onRemovePossibleValue, possibleValueInput } = props;

  return (
    <div className="space-y-1.5">
      <Label>Possible values</Label>
      <div className="flex gap-2">
        <SlugInput
          disabled={disabled}
          value={possibleValueInput}
          onChange={(event) => onPossibleValueInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddPossibleValue();
            }
          }}
        />
        <Button disabled={disabled || !possibleValueInput} onClick={onAddPossibleValue} type="button" variant="outline">
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {enumValues.map((value) => (
          <Badge className="gap-1" key={value} variant="secondary">
            {value}
            <button disabled={disabled} onClick={() => onRemovePossibleValue(value)} type="button">
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default PossibleValuesEditor;
