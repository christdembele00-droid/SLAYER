import os,unittest
from unittest import mock
from .cloudinary import CloudinaryValidationError, sign_upload, validate_upload_folder
class CloudinarySigningTests(unittest.TestCase):
    def setUp(self):
        self.old={k:os.environ.get(k) for k in ["CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET"]}
        os.environ["CLOUDINARY_CLOUD_NAME"]="bk4jm7px"; os.environ["CLOUDINARY_API_KEY"]="test-api-key"; os.environ["CLOUDINARY_API_SECRET"]="test-secret"
    def tearDown(self):
        for k,v in self.old.items():
            if v is None: os.environ.pop(k,None)
            else: os.environ[k]=v
    def test_folder_allowlist(self):
        self.assertEqual(validate_upload_folder("slayer/players/models"),"slayer/players/models")
        with self.assertRaises(CloudinaryValidationError): validate_upload_folder("other/project")
        with self.assertRaises(CloudinaryValidationError): validate_upload_folder("slayer/players/../private")
    def test_signature_deterministic(self):
        with mock.patch("server.cloudinary.time.time",return_value=1750000000):
            a=sign_upload("slayer/players/models","raw","player.glb"); b=sign_upload("slayer/players/models","raw","player.glb")
        self.assertEqual(a.signature,b.signature); self.assertEqual(a.timestamp,1750000000); self.assertTrue(a.upload_url.endswith("/raw/upload"))
if __name__=="__main__": unittest.main()
