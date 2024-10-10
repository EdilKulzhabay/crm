import { useState, useEffect, useCallback } from "react";

const useScrollPosition = () => {
    const [scrollPosition, setScrollPosition] = useState(0);

    const handleScroll = useCallback(() => {
        setScrollPosition(window.scrollY);
    }, []);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        
        // Удаление обработчика при размонтировании компонента
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll]);

    return scrollPosition;
};

export default useScrollPosition;
