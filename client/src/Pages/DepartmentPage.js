import { useNavigate, useParams } from "react-router-dom";
import Container from "../Components/Container";
import { useState } from "react";

export default function DepartmentPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [department, setDepartment] = useState({});

    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const closeSnack = () => {
        setOpen(false);
    };

    const [updates, setUpdates] = useState({
        fullNameOpen: false,
        fullNameStr: "",
        phoneOpen: false,
        phoneStr: "",
        mailOpen: false,
        mailStr: "",
    });
    return <Container role="superAdmin">

    </Container>
}