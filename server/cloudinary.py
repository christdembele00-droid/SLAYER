import hashlib, os, re, time
from dataclasses import dataclass

ALLOWED_UPLOAD_ROOTS=("slayer/players","slayer/stadium","slayer/ball","slayer/effects","slayer/kits","slayer/emblems","slayer/ui","slayer/catalog","slayer/cinematics","slayer/crowd","slayer/audio")
SAFE_PUBLIC_ID=re.compile(r"^[A-Za-z0-9._/-]{1,180}$")

class CloudinaryConfigError(RuntimeError): pass
class CloudinaryValidationError(ValueError): pass

@dataclass(frozen=True)
class CloudinaryUploadSignature:
    cloud_name:str
    api_key:str
    timestamp:int
    folder:str
    signature:str
    upload_url:str
    resource_type:str
    public_id:str|None=None

def validate_upload_folder(folder:str)->str:
    folder=(folder or "").strip().strip("/")
    if not folder or ".." in folder or "\x00" in folder: raise CloudinaryValidationError("invalid_folder")
    if not any(folder==root or folder.startswith(root+"/") for root in ALLOWED_UPLOAD_ROOTS): raise CloudinaryValidationError("folder_not_allowed")
    return folder

def validate_public_id(public_id:str|None)->str|None:
    if public_id in (None,""): return None
    if not SAFE_PUBLIC_ID.fullmatch(public_id): raise CloudinaryValidationError("invalid_public_id")
    return public_id

def _config()->tuple[str,str,str]:
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME","").strip(); api_key=os.getenv("CLOUDINARY_API_KEY","").strip(); api_secret=os.getenv("CLOUDINARY_API_SECRET","").strip()
    if not cloud_name or not api_key or not api_secret: raise CloudinaryConfigError("cloudinary_not_configured")
    return cloud_name,api_key,api_secret

def _signature(params:dict[str,str|int],api_secret:str)->str:
    serialized="&".join(f"{k}={params[k]}" for k in sorted(params) if params[k] is not None)
    return hashlib.sha1((serialized+api_secret).encode()).hexdigest()

def sign_upload(folder:str,resource_type:str="auto",public_id:str|None=None)->CloudinaryUploadSignature:
    folder=validate_upload_folder(folder); public_id=validate_public_id(public_id)
    if resource_type not in {"auto","image","video","raw"}: raise CloudinaryValidationError("resource_type_not_allowed")
    cloud_name,api_key,api_secret=_config(); timestamp=int(time.time())
    params={"folder":folder,"timestamp":timestamp}
    if public_id: params["public_id"]=public_id
    return CloudinaryUploadSignature(cloud_name,api_key,timestamp,folder,_signature(params,api_secret),f"https://api.cloudinary.com/v1_1/{cloud_name}/{resource_type}/upload",resource_type,public_id)
