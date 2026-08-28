import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { ClientNoteEntity } from '../../database/entities';

@Injectable()
export class ClientNoteService extends BaseCrudService<ClientNoteEntity> {
  constructor() { super(ClientNoteEntity); }
}
