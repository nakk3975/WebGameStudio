package studio.webgame.ghostdesk;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest(controllers=SaveController.class,properties="app.allowed-origins=https://game.example")
class SaveControllerTest {
 @Autowired MockMvc mvc;
 @MockitoBean AccountIdentity identity;
 @MockitoBean SaveService service;
 @MockitoBean CatalogMapper catalog;
 final String save="{\"format\":\"ghostdesk-save-1\",\"case\":{\"caseId\":\"demo\",\"versionId\":\"v1\"},\"state\":{\"caseVersionId\":\"v1\",\"schemaVersion\":1,\"engineVersion\":\"ghostdesk-core-1\"},\"notes\":\"hello\",\"checkpoint\":null}";
 void signed(){when(identity.require("Bearer token","user-a")).thenReturn("user-a");when(catalog.packageJson("v1")).thenReturn("{\"caseId\":\"demo\",\"versionId\":\"v1\"}");}
 @Test void unauthenticatedReadNeverReachesStorage() throws Exception {when(identity.require(null,null)).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));mvc.perform(get("/api/v1/ghostdesk/saves")).andExpect(status().isUnauthorized());verifyNoInteractions(service);}
 @Test void readsOnlyVerifiedOwnerAndDisablesCaching() throws Exception {signed();when(service.list("user-a")).thenReturn(List.of());mvc.perform(get("/api/v1/ghostdesk/saves").header("Authorization","Bearer token").header("X-GhostDesk-Account","user-a")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));verify(service).list("user-a");}
 @Test void returnsConflictWithCurrentSave() throws Exception {signed();when(service.put(eq("user-a"),eq("demo"),eq("v1"),anyString(),eq(1L))).thenReturn(new SaveService.Result(true,new SaveMapper.Row("demo","v1",save,2,"today")));mvc.perform(put("/api/v1/ghostdesk/saves/demo").header("Authorization","Bearer token").header("X-GhostDesk-Account","user-a").contentType("application/json").content("{\"expectedRevision\":1,\"save\":"+save+"}")).andExpect(status().isConflict()).andExpect(jsonPath("$.current.revision").value(2)).andExpect(header().string("Cache-Control","no-store"));}
 @Test void rejectsInvalidBodyBeforeWriting() throws Exception {signed();for(String body:List.of("[]","{}","{\"expectedRevision\":-1,\"save\":"+save+"}","{\"expectedRevision\":0,\"save\":"+save.replace("hello","x".repeat(10001))+"}"))mvc.perform(put("/api/v1/ghostdesk/saves/demo").header("Authorization","Bearer token").header("X-GhostDesk-Account","user-a").contentType("application/json").content(body)).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void rejectsOversizedUpload() throws Exception {signed();mvc.perform(put("/api/v1/ghostdesk/saves/demo").header("Authorization","Bearer token").header("X-GhostDesk-Account","user-a").contentType("application/json").content("x".repeat(1048577))).andExpect(status().isPayloadTooLarge());verifyNoInteractions(service);}
 @Test void corsAllowsAuthenticatedPutFromConfiguredOrigin() throws Exception {mvc.perform(options("/api/v1/ghostdesk/saves/demo").header("Origin","https://game.example").header("Access-Control-Request-Method","PUT").header("Access-Control-Request-Headers","authorization,content-type,x-ghostdesk-account")).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","https://game.example"));}
}
