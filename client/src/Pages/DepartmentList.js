import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import api from "../api";
import LinkButton from "../Components/LinkButton";

export default function DepartmentList() {

    const [departments, setDepartments] = useState([])

    useEffect(() => {
        api.get('/getDepartments', {
            headers: { "Content-Type": "application/json" },
        }).then(({data}) => {
            setDepartments(data.departments)
        }).catch((e) => {
            console.log(e);
        })
    }, [])

    return <Container role="superAdmin">
        <Div>Сотрудники цеха</Div>
        <Div />

        <Div>Список сотрудников цеха:</Div>
        <div className="min-h-180 overflow-y-scroll">
            {departments && departments.length > 0 && departments.map((item) => {
                return <div key={item._id}>
                    <Div>
                        <div className="flex items-center gap-x-2">
                            <div>{item.userName}</div>
                            <LinkButton href={`/departmentPage/${item._id}`}>Перейти</LinkButton>
                        </div>
                    </Div>
                </div>
            })}
        </div>

        <Div/>
        <Div>
            <LinkButton href="addDepartment">Создать сотрудника</LinkButton>
        </Div>

        <Div />
    </Container>
}