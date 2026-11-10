"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DEFENSE_COLOR, type AkitReceiver } from "@/lib/akit"

const POSITIONS = ["All", "WR", "TE", "RB"] as const

/** Searchable receiver picker: everything on the page below the hero follows this choice. */
export function ReceiverPicker({
  receivers,
  value,
  onChange,
  compact = false,
}: {
  receivers: AkitReceiver[]
  value: number | null
  onChange: (id: number) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<(typeof POSITIONS)[number]>("All")
  const current = receivers.find((r) => r.nfl_id === value)
  const shown = useMemo(() => (pos === "All" ? receivers : receivers.filter((r) => r.nfl_position === pos)), [receivers, pos])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-sm text-zinc-200 transition-colors hover:border-orange-400/60 hover:bg-white/[0.06]"
          >
            {current?.display_name ?? "Choose a receiver"}
            <ChevronsUpDown className="size-3.5 text-zinc-500" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Choose a receiver"
            className="group flex h-11 items-center gap-3 rounded-lg border border-orange-500/50 bg-orange-500/[0.08] py-1 pr-3 pl-1.5 text-left transition-colors hover:border-orange-400/80 hover:bg-orange-500/[0.14]"
          >
            <span className="flex size-8 items-center justify-center rounded-md text-white" style={{ background: DEFENSE_COLOR }}>
              <UserRound className="size-4" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] font-medium tracking-wide text-orange-300/90 uppercase">Receiver · change</span>
              <span className="flex items-baseline gap-2 text-sm font-medium text-zinc-50">
                {current?.display_name ?? "Choose a receiver"}
                {current && (
                  <span className="text-xs font-normal text-zinc-400">
                    {current.nfl_position} · {current.targets} targets
                  </span>
                )}
              </span>
            </span>
            <ChevronsUpDown className="ml-1 size-4 text-zinc-400 group-hover:text-zinc-200" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] border-white/10 bg-[#0e1014] p-0">
        {/* Equal scores keep list order, so matches stay sorted by targets. */}
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={`Search ${receivers.length} receivers…`} />
          <div className="flex gap-1 border-b border-white/10 px-2 py-2">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPos(p)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  pos === p ? "bg-orange-500/15 text-orange-200" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                )}
              >
                {p}
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] text-zinc-500">most targets first</span>
          </div>
          <CommandList className="max-h-80">
            <CommandEmpty>No receiver found.</CommandEmpty>
            {shown.map((r) => (
              <CommandItem
                key={r.nfl_id}
                value={`${r.display_name} ${r.nfl_position}`}
                onSelect={() => {
                  onChange(r.nfl_id)
                  setOpen(false)
                }}
                className="flex items-center gap-2"
              >
                <Check className={cn("size-4", r.nfl_id === value ? "text-orange-300" : "opacity-0")} />
                <span className="flex-1 truncate">{r.display_name}</span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">{r.nfl_position}</span>
                <span className="w-16 text-right text-xs text-zinc-500 tabular-nums">{r.targets} tgts</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
