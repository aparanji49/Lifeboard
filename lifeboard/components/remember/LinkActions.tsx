import { CopyIcon, EditIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
export default function LinkActions() {
    return (
        <div className="flex flex-row justify-between gap-2">
            {/* Copy */}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm">
                  <CopyIcon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="[&_svg]:invisible rounded-full bg-white shadow-md">
                <p>Copy</p>
              </TooltipContent>
            </Tooltip>

            {/* Edit */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm">
               <EditIcon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="[&_svg]:invisible rounded-full bg-white shadow-md">
                <p>Edit</p>
              </TooltipContent>
            </Tooltip>
            {/* Delete */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button size="sm">
                        <TrashIcon className="w-4 h-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="[&_svg]:invisible rounded-full bg-white shadow-md">
                    <p>Delete</p>
                </TooltipContent>
            </Tooltip>
          </div>
    );
}