from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from akit import PLAYS, router as akit_router

app = FastAPI(title="AirSpace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(akit_router)


@app.get("/")
async def root():
    return {"message": "AirSpace API"}


@app.get("/health")
async def health():
    return {"status": "alive", "plays": len(PLAYS)}
