package studio.webgame.ghostdesk;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SaveService {
    private final SaveMapper mapper;
    public SaveService(SaveMapper mapper) { this.mapper=mapper; }
    public record Result(boolean conflict, SaveMapper.Row row) {}
    @Transactional
    public List<SaveMapper.Row> list(String user) {
        mapper.scope(user);
        return mapper.list(user);
    }
    @Transactional
    public Result put(String user,String caseId,String versionId,String payload,long expected) {
        mapper.scope(user);
        int changed=expected==0 ? mapper.insert(user,caseId,versionId,payload)
            : mapper.update(user,caseId,versionId,payload,expected);
        return new Result(changed==0,mapper.get(user,caseId));
    }
}
