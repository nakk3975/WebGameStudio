import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Fits files into the available desktop, without a scrolling icon rail. */
export default function DesktopFiles({
  items,
  introduction,
}: {
  items: { id: string; content: ReactNode }[];
  introduction?: ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ columns: 6, rows: 5, capacity: 1000 });
  const [page, setPage] = useState(0);
  useLayoutEffect(() => {
    const el = grid.current!;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const font = parseFloat(getComputedStyle(el).fontSize) || 16;
      const gap = 12;
      const columns = Math.max(1, Math.floor((width + gap) / (font * 7 + gap)));
      const rows = Math.max(1, Math.floor((height + gap) / (font * 7.5 + gap)));
      const capacity = columns * rows;
      setLayout((old) =>
        old.columns === columns &&
        old.rows === rows &&
        old.capacity === capacity
          ? old
          : { columns, rows, capacity },
      );
    };
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const pages = Math.max(1, Math.ceil(items.length / layout.capacity));
  const currentPage = Math.min(page, pages - 1);
  useLayoutEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);
  const start = currentPage * layout.capacity;
  return (
    <section className="desktop-files" aria-label="바탕화면 파일">
      <div className="desktop-file-heading">
        <div>
          <h2>바탕화면</h2>
          <p>파일을 한 번 클릭해서 열어보세요. 읽은 파일에는 ✓가 남습니다.</p>
        </div>
        <span>{items.length}개 자료</span>
      </div>
      {introduction}
      <div
        className="desktop-grid"
        ref={grid}
        tabIndex={-1}
        style={{
          gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        }}
      >
        {items.slice(start, start + layout.capacity).map((item) => (
          <div className="desktop-cell" key={item.id}>
            {item.content}
          </div>
        ))}
      </div>
      <nav className="desktop-pages" aria-label="바탕화면 페이지">
        {pages > 1 ? (
          <>
            <button
              aria-label="이전 바탕화면 페이지"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} /> 이전
            </button>
            <span role="status">
              {currentPage + 1} / {pages} 페이지
            </span>
            <button
              aria-label="다음 바탕화면 페이지"
              disabled={currentPage === pages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              다음 <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <span>자물쇠는 암호가 필요한 폴더입니다.</span>
        )}
      </nav>
    </section>
  );
}
