// Swapping a slide's photo: Pip's other picks, a new search, your own upload,
// a link, or an AI painting.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Link2, LoaderCircle, Paintbrush, Search, Upload } from "lucide-react";
import { Button, Dialog, Switch, cx } from "../ui";
import { inputClass } from "../pages/forms";
import { candidatesFor, paintPhoto, pinPhoto, rememberCandidates, searchPhotos, uploadPhoto } from "./engine";

const SOURCE_LABEL = { web: "Web", wikimedia: "Wikimedia", openverse: "Openverse", upload: "Yours", ai: "AI" };

export function PhotoPicker({ project, variant, slide, onPick, onClose }) {
  const c = project.carousel;
  const [query, setQuery] = useState(slide.image?.query || slide.title || "");
  const [licensed, setLicensed] = useState(!!c.licensed);
  const [list, setList] = useState(() => candidatesFor(slide.id) || []);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const file = useRef(null);

  const search = async (q = query) => {
    if (q.trim().length < 2) return;
    setBusy("search");
    setError("");
    try {
      const found = await searchPhotos(q.trim(), { licensed, entity: slide.image?.kind === "entity" });
      setList(found);
      rememberCandidates(slide.id, found);
      if (!found.length) setError("Nothing came back for that search. Try different words.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    if (!list.length && query.trim().length >= 2) search();
  }, []);

  const pick = async (cand) => {
    setBusy(cand.id);
    setError("");
    try {
      onPick(await pinPhoto(cand, project.id));
      onClose();
    } catch (err) {
      setError(err.message || "That photo couldn't be downloaded. Pick another one.");
    } finally {
      setBusy("");
    }
  };

  const run = async (kind, fn) => {
    setBusy(kind);
    setError("");
    try {
      onPick(await fn());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog title="Choose a photo" description={`Slide: ${slide.title}`} onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2"
      >
        <label className="relative flex-1">
          <span className="sr-only">Search photos</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What should the photo show?" className={cx(inputClass, "pl-10 text-sm")} />
        </label>
        <Button type="submit" variant="secondary" disabled={!!busy}>
          {busy === "search" ? <LoaderCircle size={16} className="animate-spin" /> : "Search"}
        </Button>
      </form>
      <label className="mt-2.5 flex items-center gap-2.5 text-[13px] text-ink-2">
        <Switch on={licensed} onChange={setLicensed} label="Only commercially licensed images" />
        Only images marked free to use commercially
      </label>

      {error && <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {busy === "search" && !list.length
          ? Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-sunken" />)
          : list.map((cand) => (
              <figure key={cand.id} className="group relative">
                <button onClick={() => pick(cand)} disabled={!!busy} className={cx("relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-sunken ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-ink", slide.img?.id === cand.id && "ring-2 ring-accent")}>
                  <img src={cand.thumb} alt={cand.title || "Search result"} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  {busy === cand.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <LoaderCircle size={22} className="animate-spin text-white" />
                    </span>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">{SOURCE_LABEL[cand.source] || cand.source}</span>
                </button>
                <figcaption className="mt-1 flex items-center justify-between gap-2 text-[11px] text-mute">
                  <span className="truncate" title={cand.license}>
                    {cand.credit}
                    {cand.width ? ` · ${cand.width}×${cand.height}` : ""}
                  </span>
                  {cand.page && (
                    <a href={cand.page} target="_blank" rel="noreferrer noopener" className="shrink-0 hover:text-ink" title="Open the source page">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </figcaption>
              </figure>
            ))}
      </div>

      <div className="mt-6 grid gap-3 border-t border-line-soft pt-5 sm:grid-cols-3">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Your own photo</p>
          <Button variant="secondary" size="sm" icon={busy === "upload" ? LoaderCircle : Upload} disabled={!!busy} onClick={() => file.current?.click()}>
            Upload
          </Button>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            aria-label="Upload a photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) run("upload", () => uploadPhoto(f, project.id));
            }}
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (/^https?:\/\//.test(link.trim())) run("link", () => pinPhoto({ id: "link", source: "web", full: link.trim(), original: link.trim(), page: link.trim(), credit: (() => { try { return new URL(link.trim()).hostname; } catch { return "Link"; } })(), license: "Unknown: check the source page before publishing" }, project.id));
          }}
        >
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Image link</p>
          <div className="flex gap-1.5">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…jpg" className={cx(inputClass, "h-9 text-sm")} />
            <Button type="submit" variant="secondary" size="sm" disabled={!!busy || !link.trim()} aria-label="Use this image link">
              {busy === "link" ? <LoaderCircle size={15} className="animate-spin" /> : <Link2 size={15} />}
            </Button>
          </div>
        </form>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Illustration</p>
          <Button
            variant="secondary"
            size="sm"
            icon={busy === "paint" ? LoaderCircle : Paintbrush}
            disabled={!!busy}
            onClick={() => run("paint", () => paintPhoto({ subject: slide.image?.subject || query || slide.title, direction: variant.direction, format: c.format, projectId: project.id }))}
          >
            Paint with AI · 2 credits
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
