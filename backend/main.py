from fastapi import FastAPI
from backend.routes.generate import router as gen_router
from backend.routes.evaluate import router as eval_router

app = FastAPI()

app.include_router(gen_router)
app.include_router(eval_router)