import { forwardRef, type ChangeEvent, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeConstantCaseInput } from "../../../shared/asset-paths";

type SlugInputProps = Omit<ComponentProps<typeof Input>, "onChange"> & {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

const SlugInput = forwardRef<HTMLInputElement, SlugInputProps>((props, ref) => {
  const { className, onChange, ...inputProps } = props;

  return (
    <Input
      {...inputProps}
      ref={ref}
      autoCapitalize="characters"
      autoComplete="off"
      className={cn("font-mono", className)}
      spellCheck={false}
      onChange={(event) => {
        event.currentTarget.value = normalizeConstantCaseInput(event.currentTarget.value);
        onChange?.(event);
      }}
    />
  );
});

SlugInput.displayName = "SlugInput";

export default SlugInput;
