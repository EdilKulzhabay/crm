/** Фильтр «с / по» (дни по Алматы, включительно). Пустые даты — за всё время */
export default function PartnerPeriodFilter({ period, onChange }) {
    const update = (field) => (event) => onChange({ ...period, [field]: event.target.value });
    const inputClass = "bg-black outline-none border-b border-white border-dashed text-sm lg:text-base";

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Период:</span>
            <span>с</span>
            <input type="date" value={period.startDate} onChange={update("startDate")} className={inputClass} />
            <span>по</span>
            <input type="date" value={period.endDate} onChange={update("endDate")} className={inputClass} />
            {(period.startDate || period.endDate) && (
                <button className="text-green-400 hover:text-blue-500" onClick={() => onChange({ startDate: "", endDate: "" })}>
                    [ За всё время ]
                </button>
            )}
        </div>
    );
}
