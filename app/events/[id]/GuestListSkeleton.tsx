export default function GuestListSkeleton() {
  return (
    <div className="pt-3">
      {/* Spinner + mensaje contextual */}
      <div className="mb-5 flex items-center gap-3 px-1">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1D1E20]">Cargando tus invitados...</p>
          <p className="text-xs text-[#aaa]">Preparando confirmaciones y acompañantes</p>
        </div>
      </div>

      {/* Skeleton desktop */}
      <div className="hidden rounded-xl border border-[#e8e8e8] sm:block">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={'flex items-center gap-4 border-b border-[#f0f0f0] px-4 py-3 ' + (i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]')}>
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#f0f0f0]" />
            <div className="flex flex-1 items-center gap-2">
              <div className="h-4 animate-pulse rounded bg-[#f0f0f0]" style={{ width: `${110 + (i * 23) % 80}px` }} />
              {i % 3 === 0 && <div className="h-3.5 w-6 animate-pulse rounded-full bg-[#f0f0f0]" />}
            </div>
            <div className="hidden gap-1.5 lg:flex">
              <div className="h-5 w-14 animate-pulse rounded-full bg-[#f0f0f0]" />
              {i % 2 === 0 && <div className="h-5 w-10 animate-pulse rounded-full bg-[#f0f0f0]" />}
            </div>
            <div className="h-5 w-14 animate-pulse rounded-full bg-[#f0f0f0]" />
            <div className="hidden h-3.5 animate-pulse rounded bg-[#f0f0f0] lg:block" style={{ width: `${60 + (i * 17) % 60}px` }} />
            <div className="hidden h-3.5 w-28 animate-pulse rounded bg-[#f0f0f0]" />
            <div className="ml-auto h-7 w-28 animate-pulse rounded-md bg-[#f0f0f0]" />
            <div className="h-4 w-4 animate-pulse rounded bg-[#f0f0f0]" />
          </div>
        ))}
      </div>

      {/* Skeleton mobile */}
      <div className="flex flex-col gap-2 sm:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#e8e8e8] bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#f0f0f0]" />
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-[#f0f0f0]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-4 animate-pulse rounded bg-[#f0f0f0]" style={{ width: `${100 + (i * 31) % 80}px` }} />
                <div className="flex gap-1">
                  {i % 2 === 0 && <div className="h-3.5 w-12 animate-pulse rounded-full bg-[#f0f0f0]" />}
                  {i % 3 !== 1 && <div className="h-3.5 w-10 animate-pulse rounded-full bg-[#f0f0f0]" />}
                </div>
              </div>
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-[#f0f0f0]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}