from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    timezone: str = "UTC"
    subjects: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    timezone: str
    subjects: list[str]
    goals: list[str]


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserSchema
