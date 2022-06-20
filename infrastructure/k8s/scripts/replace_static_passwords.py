import os
import sys
import uuid

import bcrypt
import yaml


PASSWORD = 'MLOpsSM@2021'
POSTFIX = '@amazon-sagemaker-mlops.pl'
PARTICIPANTS_COUNT = 15

def should_use_block(value):
    for c in u'\u000a\u000d\u001c\u001d\u001e\u0085\u2028\u2029':
        if c in value:
            return True

    return False

def custom_represent_scalar(self, tag, value, style = None):
    if style is None:
        if should_use_block(value):
             style = '|'
        else:
            style = self.default_style

    node = yaml.representer.ScalarNode(tag, value, style = style)

    if self.alias_key is not None:
        self.represented_objects[self.alias_key] = node

    return node

def create_user_entry(name, hashed_password):
    return {
        'email': f'{name}{POSTFIX}',
        'username': name,
        'userID': str(uuid.uuid4()),
        'hash': hashed_password
    }

if __name__ == '__main__':
    if sys.stdin.isatty():
        print(f'Usage: cat some-file.yaml | python {sys.argv[0]}')
        os._exit(os.EX_DATAERR)

    yaml.representer.BaseRepresenter.represent_scalar = custom_represent_scalar

    salt = bcrypt.gensalt(rounds = 12)
    hashed = bcrypt.hashpw(str.encode(PASSWORD), salt).decode('utf-8')

    users = [ create_user_entry('admin', hashed) ]

    for i in range(1, PARTICIPANTS_COUNT + 1):
        user_name = f'user{str(i).zfill(3)}'
        users.append(create_user_entry(user_name, hashed))

    with sys.stdin as source:
        try:
            content = yaml.safe_load(source)

            data = content['data']['config.yaml']
            config = yaml.safe_load(data)

            config['staticPasswords'] = users
            content['data']['config.yaml'] = yaml.dump(config, default_flow_style = False)

            print(yaml.dump(content, default_flow_style = False))

        except yaml.YAMLError as exception:
            print(exception)
