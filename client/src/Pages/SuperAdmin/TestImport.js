import React, { useState } from "react";
import api from "../../api";

export default function TestImport() {
    const [file, setFile] = useState(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await api.post("/api/upload-excel", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            console.log(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                />
                <button type="submit">Upload</button>
            </form>
        </div>
    );
}
