"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReleaseAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Number of cards that will be released — shown in the copy. */
  count: number;
}

/**
 * Confirm dialog for the destructive "release entire collection" action. Kid-safe
 * copy that makes clear the cards go free and the action can't be undone.
 */
export function ReleaseAllDialog({
  open,
  onOpenChange,
  onConfirm,
  count,
}: ReleaseAllDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">
            Release all cards?
          </DialogTitle>
          <DialogDescription>
            This lets go of all {count} {count === 1 ? "card" : "cards"} in your
            collection. You can’t undo this.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep them</Button>
          </DialogClose>
          <Button
            className="bg-red text-white hover:bg-red/90"
            onClick={onConfirm}
          >
            Release all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
