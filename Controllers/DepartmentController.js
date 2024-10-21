import Department from "../Models/Department.js";
import DepartmentHistory from "../Models/DepartmentHistory.js";
import Queue from "../Models/Queue.js";
import User from "../Models/User.js";
import bcrypt from "bcrypt";

export const addDepartment = async (req, res) => {
    try {
        const { fullName, userName, receiving } = req.body;

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
            userName,
            receiving
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

export const departmentAction = async (req, res) => {
    try {
        const {id, franchisee, type, data} = req.body

        const department = await Department.findById(id)

        const history = new DepartmentHistory({
            department: id,
            franchisee,
            type,
            data
        })

        await history.save()

        if (type) {
            const queue = new Queue({
                franchisee
            })
            await queue.save()
        } else {
            await Queue.findOneAndDelete({franchisee})
        }
        
        department.save()

        const fran = await User.findById(franchisee)
        if (type) {
            fran.b121kol = fran.b121kol + data.b121kol
            fran.b191kol = fran.b191kol + data.b191kol
            fran.b197kol = fran.b197kol + data.b197kol
        } else {
            fran.b121kol = fran.b121kol - data.b121kol
            fran.b191kol = fran.b191kol - data.b191kol
            fran.b197kol = fran.b197kol - data.b197kol
        }

        fran.save()

        res.json({
            success: true
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getFirstQueue = async (req, res) => {
    try {
        const queue = await Queue.findOne({})

        let franchisee = null
        if (queue) {
            const id = queue.franchisee
            franchisee = await User.findById(id)
        }

        if (franchisee === null) {
            return res.json({
                success: false
            })
        }

        res.json({
            success: true,
            franchisee
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}

export const getDepartmentHistory = async (req, res) => {
    try {
        const {startDate, endDate, franchisee, status} = req.body
        const eDate = new Date(`${endDate}T23:59:59`)

        const filter = {
            "createdAt": { $gte: startDate, $lte: eDate },
        };

        if (franchisee !== "all") {
            filter.franchisee = franchisee
        }

        if (status !== "all") {
            const type = status === "receiving" ? true : false
            filter.type = type
        }

        const history = await DepartmentHistory.find(filter)
        .populate("department")
        .populate("franchisee")

        res.json({history})
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Что-то пошло не так",
        });
    }
}