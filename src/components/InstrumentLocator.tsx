// Where an instrument is, what the drawing shows around it, and what the system
// simply does not know.
//
// The three questions an operator asks at a DCS screen are "where is it?",
// "what is it on?" and "what are its values?". This panel answers all three from
// the pre-extracted P&ID index, and states the limits rather than hiding them:
// the drawing text does not carry instrument bubble positions, and a loop number
// of one to three digits matches too much of a sheet to assert a connection.

import { Link } from "react-router-dom";
import {
  AlertTriangle, BadgeCheck, CircleDot, FileText, Gauge, Layers, MapPin,
  Ruler, ShieldAlert, Wrench,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/contexts/I18nContext";
import { describeInstrument } from "@/lib/instrumentTags";
import { instrumentContext } from "@/lib/instrumentLocation";
import type { InstrumentEntry } from "@/lib/instrumentIndex";

const L = (lang: "en" | "fr", en: string, fr: string) => (lang === "fr" ? fr : en);

const SOURCE_STYLE: Record<string, string> = {
  isa: "border-slate-500/40 text-slate-300 bg-slate-500/10",
  dcs: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  register: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  drawing: "border-amber-500/40 text-amber-400 bg-amber-500/10",
};

const SOURCE_LABEL: Record<string, { en: string; fr: string }> = {
  isa: { en: "ISA tag", fr: "Tag ISA" },
  dcs: { en: "DCS scan", fr: "Relevé DCS" },
  register: { en: "Register", fr: "Registre" },
  drawing: { en: "Drawing (OCR)", fr: "Plan (OCR)" },
};

interface Props {
  entry: InstrumentEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InstrumentLocator({ entry, open, onOpenChange }: Props) {
  const { lang } = useI18n();
  const context = entry ? instrumentContext(entry, lang) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border border-border text-foreground rounded-2xl"
        data-testid="instrument-locator"
      >
        {!entry || !context ? null : (
          <>
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="flex items-center gap-3 text-lg font-display">
                <Gauge className="h-4 w-4 text-cyan-500" />
                <span className="font-mono text-cyan-400">{context.tag}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {describeInstrument(entry.parsed, lang)}
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground pt-2 leading-relaxed" data-testid="locator-summary">
                {lang === "fr" ? context.summaryFr : context.summaryEn}
              </p>
            </DialogHeader>

            {/* ── Where it is ─────────────────────────────────────────────── */}
            <Section
              icon={<MapPin className="h-3.5 w-3.5" />}
              title={L(lang, "Where it is", "Où il se trouve")}
              testId="locator-placements"
            >
              {context.placements.length === 0 ? (
                <p className="text-xs text-amber-500/90 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {L(lang, context.missing[0] ?? "No drawing could be tied to this tag.", context.missing[0] ?? "Aucun plan n'a pu être relié à ce tag.")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {context.placements.map((placement) => (
                    <li
                      key={placement.file}
                      className="border border-border rounded-lg p-3 bg-secondary/20 hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm text-cyan-400">
                              {placement.drawing ?? placement.title}
                            </span>
                            {placement.drawing && placement.title !== placement.drawing && (
                              <span className="text-xs text-foreground/80 truncate">{placement.title}</span>
                            )}
                            {placement.localPdf && (
                              <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                                {L(lang, "vector PDF", "PDF vectoriel")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-1 flex items-center gap-1.5">
                            <CircleDot className="h-3 w-3" />
                            {L(lang, "Unit", "Unité")} {placement.unit ?? context.unitCode ?? "—"}
                            {placement.equipmentOnSheet.length > 0 && (
                              <span>
                                {" · "}
                                {L(lang, "shows", "montre")} {placement.equipmentOnSheet.slice(0, 4).join(", ")}
                                {placement.equipmentOnSheet.length > 4 ? ` +${placement.equipmentOnSheet.length - 4}` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link
                          to={placement.url}
                          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          {L(lang, "Open drawing", "Ouvrir le plan")}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* ── What it is connected to ─────────────────────────────────── */}
            {context.equipmentOnDrawings.length > 0 && (
              <Section
                icon={<Wrench className="h-3.5 w-3.5" />}
                title={L(lang, "Equipment shown on those drawings", "Équipements figurant sur ces plans")}
                testId="locator-equipment"
              >
                <div className="flex flex-wrap gap-1.5">
                  {context.equipmentOnDrawings.slice(0, 18).map((item) =>
                    item.inRegister ? (
                      <Link
                        key={item.tag}
                        to={`/equipment/${encodeURIComponent(item.tag)}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border border-border text-foreground/80 hover:border-cyan-500/40 hover:text-cyan-400 transition-colors"
                      >
                        {item.tag}
                      </Link>
                    ) : (
                      <span
                        key={item.tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border border-border text-muted-foreground"
                        title={L(lang, "Tag read on the drawing — not in the equipment register", "Tag lu sur le plan — absent du registre des équipements")}
                      >
                        {item.tag}
                      </span>
                    ),
                  )}
                  {context.equipmentOnDrawings.length > 18 && (
                    <span className="text-[11px] font-mono text-muted-foreground self-center">
                      +{context.equipmentOnDrawings.length - 18}
                    </span>
                  )}
                </div>
              </Section>
            )}

            {context.lines.length > 0 && (
              <Section
                icon={<Ruler className="h-3.5 w-3.5" />}
                title={L(lang, "Piping carried by those drawings", "Tuyauteries portées par ces plans")}
                testId="locator-lines"
              >
                <div className="flex flex-wrap gap-1.5">
                  {context.lines.map((line) => (
                    <span
                      key={`${line.file}-${line.asRead}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border border-amber-500/30 text-amber-300/90 bg-amber-500/5"
                      title={line.file}
                    >
                      {line.asRead}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {L(
                    lang,
                    "Read as-is from the drawing. None of these is asserted to be the instrument's own tap — compare the loop number on the drawing.",
                    "Relevées telles quelles sur le plan. Aucune n'est présentée comme le piquage de l'instrument — comparez le numéro de boucle sur le plan.",
                  )}
                </p>
              </Section>
            )}

            {/* ── Specifications ──────────────────────────────────────────── */}
            <Section
              icon={<Layers className="h-3.5 w-3.5" />}
              title={L(lang, "Specifications", "Caractéristiques")}
              testId="locator-specs"
            >
              <table className="w-full text-xs">
                <tbody>
                  {context.specs.map((spec) => (
                    <tr key={`${spec.source}-${spec.labelEn}`} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap align-top">
                        {lang === "fr" ? spec.labelFr : spec.labelEn}
                      </td>
                      <td className="py-1.5 pr-3 text-foreground/90">{spec.value}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        <Badge variant="outline" className={`font-mono text-[10px] ${SOURCE_STYLE[spec.source]}`}>
                          {lang === "fr" ? SOURCE_LABEL[spec.source].fr : SOURCE_LABEL[spec.source].en}
                        </Badge>
                        {spec.verified && <BadgeCheck className="inline h-3 w-3 ml-1 text-emerald-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* ── What we cannot tell ─────────────────────────────────────── */}
            <Section
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              title={L(lang, "Not available here", "Non disponible ici")}
              testId="locator-missing"
            >
              <ul className="space-y-1.5">
                {context.missing.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] text-amber-500/90">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground pt-1">
              {L(
                lang,
                "Drawings read by OCR — no sheet has been signed off by an engineer yet.",
                "Plans lus par OCR — aucun plan n'a encore été validé par un ingénieur.",
              )}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon, title, children, testId,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="space-y-2 pt-2" data-testid={testId}>
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
