import Department from "../Models/Department.js";
import bcrypt from "bcrypt";

export const addDepartment = async (req, res) => {
    try {
        const { fullName, userName } = req.body;

        const candidate = await Department.findOne({ userName });

        if (candidate) {
            return res.status(409).json({
                success: false,
                message: "Сотрудник цеха с таким именем уже существует",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(req.body.password, salt);

        const doc = new Department({
            fullName,
            password: hash,
            userName
        });

        await doc.save();

        res.json({
            success: true,
            message: "Сотрудник цеха успешно добавлен",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
};

export const getDepartments = async (req, res) => {
    try {
        const departments = await Department.find()

        res.json({departments})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getDepartmentData = async (req, res) => {
    try {
        const { id } = req.body
        const department = await Department.findById(id)

        if (!department) {
            res.status(500).json({
                message: "Department not found",
            });
        }

        res.json({department})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const updateDepartmentData = async (req, res) => {
    try {
        const { departmentId, field, value } = req.body;

        const department = await Department.findById(departmentId);
        if (!department) {
            return res
                .status(404)
                .json({ success: false, message: "Client not found" });
        }

        department[field] = value;
        await department.save();

        res.json({ success: true, message: "Данные успешно изменены" });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.body
        const delRes = await Department.findByIdAndDelete(id);

        if (!delRes) {
            return res.status(400).json({
                success: false,
                message: "Не удалось удалить сотрудника",
            });
        }
        res.json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}