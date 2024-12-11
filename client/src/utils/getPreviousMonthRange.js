const getPreviousMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // индекс месяца (0-11)
    
    // Предыдущий месяц
    const prevMonth = new Date(year, month - 1, 1);
    const prevYear = prevMonth.getFullYear();
    const prevMon = String(prevMonth.getMonth() + 1).padStart(2, '0');

    const start = `${prevYear}-${prevMon}-01`;
    // Последний день предыдущего месяца
    const lastDayOfPrevMonth = new Date(prevYear, prevMonth.getMonth() + 1, 0).getDate();
    const end = `${prevYear}-${prevMon}-${String(lastDayOfPrevMonth).padStart(2, '0')}`;
    
    return { start, end };
};

export default getPreviousMonthRange