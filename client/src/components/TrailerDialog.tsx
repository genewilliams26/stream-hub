import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Modal trailer player. Embeds the trailer URL (e.g. YouTube embed) in a 16:9
// frame. Closing the dialog stops playback by unmounting the iframe.

export function TrailerDialog({
  open,
  onOpenChange,
  title,
  trailerUrl,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  trailerUrl?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-card-border bg-card p-0 overflow-hidden">
        <DialogTitle className="sr-only">{title} trailer</DialogTitle>
        <div className="aspect-video w-full bg-black">
          {open && trailerUrl && (
            <iframe
              className="h-full w-full"
              src={trailerUrl}
              title={`${title} trailer`}
              allow="accelerated-encoder; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              data-testid="iframe-trailer"
            />
          )}
        </div>
        <div className="px-5 py-3 text-sm font-medium text-foreground">{title}</div>
      </DialogContent>
    </Dialog>
  );
}
