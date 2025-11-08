#!/bin/bash
cd /home/quigley/projects/Tinkertools/backend
source venv/bin/activate
export $(cat .env.local | grep -v '^#' | xargs)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
