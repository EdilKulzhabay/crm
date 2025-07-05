#!/usr/bin/env bash
set -e

# 1. Создать виртуальное окружение, если его ещё нет
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

# 2. Установить/обновить зависимости
./venv/bin/pip install -U pip
./venv/bin/pip install -r requirements.txt