import subprocess, sys, os
cwd = r'C:\Users\ASHUTOSH KUMAR\Desktop\socialconnect-main'
try:
    s = subprocess.check_output(['git','status','--porcelain'], cwd=cwd, text=True)
except subprocess.CalledProcessError as e:
    print('GIT_STATUS_FAILED')
    print(e.output)
    sys.exit(2)
if not s.strip():
    print('NO_CHANGES')
    sys.exit(0)
try:
    subprocess.check_call(['git','add','-A'], cwd=cwd)
    subprocess.check_call(['git','commit','-m','Apply workspace changes: meta, logo, auth, server routing'], cwd=cwd)
    subprocess.check_call(['git','push','origin','main'], cwd=cwd)
    print('PUSHED')
except subprocess.CalledProcessError as e:
    print('GIT_CMD_FAILED')
    print(e.output)
    sys.exit(3)
