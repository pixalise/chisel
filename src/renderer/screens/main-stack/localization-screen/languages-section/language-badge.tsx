import { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface LanguageBadgeProps {
  isDefaultLanguage: boolean;
  language: string;
  onRemoveLanguage: () => void;
}

const LanguageBadge: FC<LanguageBadgeProps> = (props) => {
  const { isDefaultLanguage, language, onRemoveLanguage } = props;
  return (
    <Badge className="gap-2 h-8 min-w-[52px] flex items-center justify-center" variant={isDefaultLanguage ? "default" : "secondary"}>
      {language}
      {!isDefaultLanguage && (
        <button className="text-xs" onClick={onRemoveLanguage}>
          <X className="w-4 h-4" />
        </button>
      )}
    </Badge>
  );
};
export default LanguageBadge;
