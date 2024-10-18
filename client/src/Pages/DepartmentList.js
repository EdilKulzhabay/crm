import { useEffect, useState } from "react";
import Container from "../Components/Container";
import Div from "../Components/Div";
import api from "../api";
import LinkButton from "../Components/LinkButton";
import useFetchUserData from "../customHooks/useFetchUserData"

export default function DepartmentList() {
    const userData = useFetchUserData();
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

    return <Container role={userData?.role}>
        <Div>Сотрудники цеха</Div>
        <Div />

        <Div>Список сотрудников цеха:</Div>
        <div className="min-h-180 overflow-y-scroll">
            {departments && departments.length > 0 && departments.map((item) => {
                return <div key={item?._id}>
                    <Div>
                        <div className="flex items-center gap-x-2">
                            <div>{item?.userName}</div>
                            <LinkButton href={`/departmentPage/${item?._id}`}>Перейти</LinkButton>
                        </div>
                    </Div>
                </div>
            })}
        </div>

        <Div/>
        <Div>
            <LinkButton color="green" href="/addDepartment">Создать сотрудника</LinkButton>
        </Div>

        <Div />
    </Container>
}